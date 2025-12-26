import React, { useState } from 'react';
import { Search, Music, Download, Clock, User, AlertCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function App() {
  const [query, setQuery] = useState('');
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState({});
  const [error, setError] = useState('');
  const [healthStatus, setHealthStatus] = useState(null);

  // Check server health on mount
  React.useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    try {
      const response = await fetch(`${API_URL}/health`);
      if (response.ok) {
        const data = await response.json();
        setHealthStatus(data);
      }
    } catch (err) {
      console.log('Health check failed, server might be starting...');
    }
  };

  const searchVideos = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError('');
    setVideos([]);

    try {
      const response = await fetch(`${API_URL}/search?query=${encodeURIComponent(query)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Search failed');
      }

      setVideos(data);
    } catch (err) {
      setError(err.message || 'Failed to search videos. Please try again.');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const downloadMP3 = async (videoId, title) => {
    setDownloading(prev => ({ ...prev, [videoId]: true }));
    setError('');

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes

    try {
      const response = await fetch(`${API_URL}/download/${videoId}`, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Accept': 'audio/mpeg',
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Download failed (${response.status})`);
      }

      // Get filename from Content-Disposition header or use video title
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `${title.replace(/[^\w\s.-]/gi, '').substring(0, 50)}.mp3`;

      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?(.+)"?/);
        if (match) {
          filename = decodeURIComponent(match[1]);
        }
      }

      // Create blob from response
      const blob = await response.blob();

      // Check if blob is valid
      if (blob.size === 0) {
        throw new Error('Empty file received');
      }

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();

      // Cleanup
      link.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 100);

      console.log(`Downloaded: ${filename} (${blob.size} bytes)`);

    } catch (err) {
      clearTimeout(timeoutId);

      if (err.name === 'AbortError') {
        setError('Download timeout. The video might be too long or there are network issues.');
      } else {
        setError(err.message || 'Failed to download MP3. Please try again.');
      }

      console.error('Download error:', err);
    } finally {
      setDownloading(prev => ({ ...prev, [videoId]: false }));
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';

    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatViews = (views) => {
    if (!views) return '0 views';

    if (views >= 1000000) {
      return `${(views / 1000000).toFixed(1)}M views`;
    } else if (views >= 1000) {
      return `${(views / 1000).toFixed(1)}K views`;
    }
    return `${views} views`;
  };

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <Music size={32} />
          <div>
            <h1>YouTube MP3 Downloader</h1>
            <small>For educational purposes only</small>
          </div>
        </div>
        {healthStatus && (
          <div className="health-status">
            <div className={`status-dot ${healthStatus.status === 'OK' ? 'online' : 'offline'}`}></div>
            <span>Server: {healthStatus.status}</span>
          </div>
        )}
      </header>

      <main className="main">
        <form onSubmit={searchVideos} className="search-form">
          <div className="search-input">
            <Search size={20} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search YouTube videos..."
              disabled={loading}
              autoFocus
            />
            {query && (
              <button
                type="button"
                className="clear-btn"
                onClick={() => setQuery('')}
              >
                ×
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="search-btn"
          >
            {loading ? (
              <>
                <span className="spinner-small"></span>
                Searching...
              </>
            ) : 'Search'}
          </button>
        </form>

        {error && (
          <div className="error-message">
            <AlertCircle size={20} />
            <span>{error}</span>
            <button
              className="close-error"
              onClick={() => setError('')}
            >
              ×
            </button>
          </div>
        )}

        {videos.length > 0 && (
          <div className="results-info">
            <p>Found {videos.length} video{videos.length !== 1 ? 's' : ''}</p>
            <button
              className="clear-results"
              onClick={() => setVideos([])}
            >
              Clear Results
            </button>
          </div>
        )}

        <div className="video-grid">
          {videos.map((video) => (
            <div key={video.id} className="video-card">
              <div className="video-thumbnail">
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  loading="lazy"
                />
                <div className="duration-badge">
                  <Clock size={12} />
                  {formatDuration(video.duration)}
                </div>
              </div>
              <div className="video-info">
                <h3 className="video-title" title={video.title}>
                  {video.title.length > 60 ? `${video.title.substring(0, 60)}...` : video.title}
                </h3>
                <div className="video-meta">
                  <span className="channel">
                    <User size={14} />
                    {video.channelTitle}
                  </span>
                  <span className="views">
                    {formatViews(video.views)}
                  </span>
                  <span className="uploaded">
                    {video.ago}
                  </span>
                </div>
                <p className="video-description">
                  {video.description ?
                    (video.description.length > 120 ? `${video.description.substring(0, 120)}...` : video.description)
                    : 'No description available'}
                </p>
                <div className="video-actions">
                  <button
                    onClick={() => downloadMP3(video.id, video.title)}
                    disabled={downloading[video.id]}
                    className="download-btn"
                  >
                    {downloading[video.id] ? (
                      <>
                        <span className="spinner"></span>
                        Converting...
                      </>
                    ) : (
                      <>
                        <Download size={16} />
                        Download MP3
                      </>
                    )}
                  </button>
                  <span className="file-size">
                    Estimated: ~{Math.round(video.duration * 0.08)} MB
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {videos.length === 0 && !loading && (
          <div className="empty-state">
            <Music size={64} />
            <p>Search for YouTube videos to convert to MP3</p>
            <small>Enter a search term above to get started</small>
            <div className="disclaimer-box">
              <h4>⚠️ Important Disclaimer</h4>
              <p>This tool is for educational purposes only. Only download content:</p>
              <ul>
                <li>You own the rights to</li>
                <li>That is in the public domain</li>
                <li>You have explicit permission to use</li>
              </ul>
              <p>Respect copyright laws and creators' rights.</p>
            </div>
          </div>
        )}

        {loading && (
          <div className="loading-state">
            <div className="spinner-large"></div>
            <p>Searching YouTube...</p>
          </div>
        )}
      </main>

      <footer className="footer">
        <div className="footer-content">
          <p>⚠️ Educational Purpose Only | Respect Copyright Laws</p>
          <div className="footer-links">
            <a href="/privacy">Privacy</a>
            <span>•</span>
            <a href="/terms">Terms</a>
            <span>•</span>
            <a href="/contact">Contact</a>
          </div>
          <p className="copyright">
            © {new Date().getFullYear()} YouTube MP3 Converter. Not affiliated with YouTube.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;