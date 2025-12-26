// index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const ytSearch = require('yt-search');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Optional wrapper detection (if installed)
let ytDlpExecWrapper = null;
try {
    const mod = require('yt-dlp-exec');
    ytDlpExecWrapper = typeof mod === 'function' ? mod : (mod.default || null);
    if (ytDlpExecWrapper) console.log('✅ yt-dlp-exec wrapper detected.');
} catch (e) {
    // not installed — we'll try system binary
}

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());

// Set ffmpeg path (from ffmpeg-static)
ffmpeg.setFfmpegPath(ffmpegStatic);

// Use system temp directory (avoids nodemon restart triggers)
const downloadsDir = path.join(os.tmpdir(), 'youtube-mp3-downloads');
if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
}
console.log(`📁 Using temp directory: ${downloadsDir}`);

// Helper: run yt-dlp -j to get metadata (returns parsed JSON)
function ytDlpMetadata(videoUrl) {
    return new Promise((resolve, reject) => {
        // prefer wrapper only for metadata if available (it returns a promise)
        if (ytDlpExecWrapper) {
            // wrapper invocation: ytDlpExecWrapper(url, { dumpSingleJson: true }) may return string or promise
            ytDlpExecWrapper(videoUrl, { dumpSingleJson: true })
                .then(output => {
                    try {
                        const parsed = typeof output === 'string' ? JSON.parse(output) : output;
                        resolve(parsed);
                    } catch (err) {
                        reject(err);
                    }
                })
                .catch(err => reject(err));
            return;
        }

        // spawn system yt-dlp -j
        const proc = spawn('yt-dlp', ['-j', videoUrl], { stdio: ['ignore', 'pipe', 'pipe'] });
        let out = '';
        let err = '';

        proc.stdout.on('data', (c) => (out += c.toString()));
        proc.stderr.on('data', (c) => (err += c.toString()));

        proc.on('error', (e) => reject(new Error('yt-dlp not found on PATH')));
        proc.on('close', (code) => {
            if (code !== 0) {
                return reject(new Error(`yt-dlp exited ${code}: ${err.trim().split('\n').slice(-5).join('\n')}`));
            }
            try {
                const json = JSON.parse(out);
                resolve(json);
            } catch (parseErr) {
                reject(parseErr);
            }
        });
    });
}

// Search endpoint using yt-search 
app.get('/api/search', async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) return res.status(400).json({ error: 'Query parameter is required' });

        const results = await ytSearch(query);
        const videos = (results.videos || []).map(v => ({
            id: v.videoId,
            title: v.title,
            description: v.description,
            thumbnail: v.thumbnail,
            channelTitle: v.author?.name || '',
            duration: v.duration?.seconds || 0,
            timestamp: v.timestamp,
            views: v.views,
            ago: v.ago
        }));
        res.json(videos);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed', details: String(error) });
    }
});

// Video metadata endpoint (uses yt-dlp -j for robust metadata)
app.get('/api/video/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const url = `https://www.youtube.com/watch?v=${id}`;
        const meta = await ytDlpMetadata(url);

        res.json({
            title: meta.title,
            duration: Math.floor(meta.duration || 0),
            author: meta.uploader || meta.uploader_id || '',
            thumbnail: (meta.thumbnails && meta.thumbnails.length) ? meta.thumbnails[0].url : null,
            formats: meta.formats || []
        });
    } catch (error) {
        console.error('Video info error:', error);
        res.status(500).json({ error: 'Failed to get video info', details: String(error).slice(0, 500) });
    }
});

// Download endpoint: spawn yt-dlp (stdout) -> ffmpeg -> response (mp3)
app.get('/api/download/:id', async (req, res) => {
    const id = req.params.id;
    const url = `https://www.youtube.com/watch?v=${id}`;

    let ytProc = null;
    let ffmpegProc = null;

    try {
        // Get metadata to build a sanitized filename and check duration
        const meta = await ytDlpMetadata(url);
        const duration = Math.floor(meta.duration || 0);
        if (duration > 3600) {
            return res.status(400).json({ error: 'Video too long. Maximum 1 hour allowed.' });
        }
        const safeTitle = (meta.title || 'audio').replace(/[^\w\s.-]/gi, '').substring(0, 60);
        const filename = `${safeTitle}.mp3`;

        // Headers
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Transfer-Encoding', 'chunked');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
        res.flushHeaders?.();

        // Spawn yt-dlp to write bestaudio to stdout (we will convert with ffmpeg)
        // Args: -f bestaudio -o - --no-playlist <url>
        ytProc = spawn('yt-dlp', ['-f', 'bestaudio', '-o', '-', '--no-playlist', url], { stdio: ['ignore', 'pipe', 'pipe'] });

        ytProc.on('error', (err) => {
            console.error('yt-dlp spawn error:', err);
        });

        let ytErr = '';
        ytProc.stderr.on('data', d => {
            ytErr += d.toString();
            // For debugging, you can uncomment:
            // console.log('[yt-dlp stderr]', d.toString());
        });

        // If yt-dlp fails to start or exits early, return an error
        ytProc.on('close', (code) => {
            if (code !== 0) {
                console.warn(`yt-dlp exited with code ${code}`);
                // if response not ended, respond with error, but only if nothing has been sent
                // Note: if conversion already started, response probably already began
            }
        });

        // Pipe yt-dlp stdout (audio stream) into ffmpeg for mp3 conversion
        // Use fluent-ffmpeg with input stream
        const ff = ffmpeg(ytProc.stdout)
            .audioBitrate(128)
            .audioCodec('libmp3lame')
            .format('mp3')
            .on('start', (cmd) => console.log('FFmpeg command:', cmd))
            .on('progress', (p) => {
                if (p && p.timemark) console.log('FFmpeg progress', p.timemark);
            })
            .on('error', (err, stdout, stderr) => {
                console.error('FFmpeg error:', err && err.message ? err.message : err);
                console.error('ffmpeg stderr:', stderr);
                // try cleanup
                try { ytProc.kill(); } catch (_) { }
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Conversion failed', details: String(err) });
                } else {
                    try { res.end(); } catch (_) { }
                }
            })
            .on('end', () => {
                console.log(`Conversion finished: ${filename}`);
            });

        // pipe to response
        ffmpegProc = ff.pipe(res, { end: true });

        // handle client aborts
        req.on('close', () => {
            if (req.aborted || res.finished) {
                console.log('Client disconnected, cleaning up processes.');
                try { ytProc && ytProc.kill('SIGKILL'); } catch (e) { }
                try { ffmpegProc && ffmpegProc.kill && ffmpegProc.kill('SIGKILL'); } catch (e) { }
            }
        });

    } catch (err) {
        console.error('Download error:', err);
        try { ytProc && ytProc.kill(); } catch (e) { }
        if (!res.headersSent) {
            res.status(500).json({ error: 'Download failed', details: String(err).slice(0, 500) });
        } else {
            try { res.end(); } catch (e) { }
        }
    }
});

// Health endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString(), tempDir: downloadsDir });
});

// Generic error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error', message: process.env.NODE_ENV === 'development' ? String(err) : undefined });
});

// Start server
const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

// Graceful shutdown
const shutdown = () => {
    console.log('Shutting down server...');
    server.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
