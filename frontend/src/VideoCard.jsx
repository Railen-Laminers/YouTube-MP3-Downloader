import React from 'react';
import { Clock, User, Download } from 'lucide-react';

const VideoCard = ({ video, downloading = {}, downloadFile, formatDuration, formatViews }) => {
    const mp3Key = `${video.id}_mp3`;
    const mp4Key = `${video.id}_mp4`;
    const mp3State = downloading[mp3Key] || null;
    const mp4State = downloading[mp4Key] || null;

    const progressText = (s) => {
        if (!s) return null;
        if (s.progress != null) return `${s.progress}%`;
        if (s.size != null) return `${(s.size / 1024 / 1024).toFixed(1)} MB`;
        return 'Processing...';
    };

    return (
        <div className="video-card" role="article" aria-label={video.title}>
            <div className="video-thumbnail">
                <img src={video.thumbnail} alt={video.title} loading="lazy" />
                <div className="duration-badge" aria-hidden>
                    <Clock size={12} />{formatDuration(video.duration)}
                </div>
            </div>

            <div className="video-info">
                <h3 className="video-title" title={video.title}>
                    {video.title.length > 70 ? `${video.title.substring(0, 70)}...` : video.title}
                </h3>

                <div className="video-meta">
                    <span className="channel"><User size={14} style={{ verticalAlign: 'middle' }} /> {video.channelTitle}</span>
                    <span className="small">{formatViews(video.views)}</span>
                </div>

                <p className="video-description">
                    {video.description ? (video.description.length > 120 ? `${video.description.substring(0, 120)}...` : video.description) : 'No description available'}
                </p>

                <div className="video-actions">
                    <button
                        onClick={() => downloadFile(video.id, video.title, 'mp3')}
                        disabled={!!mp3State?.downloading}
                        className="download-btn"
                        aria-label={`Download ${video.title} as MP3`}
                    >
                        {mp3State?.downloading ? `${mp3State.progress != null ? `${mp3State.progress}%` : 'Converting...'}` :
                            (<><Download size={14} style={{ verticalAlign: 'middle' }} />&nbsp;MP3</>)}
                    </button>

                    <button
                        onClick={() => downloadFile(video.id, video.title, 'mp4')}
                        disabled={!!mp4State?.downloading}
                        className="download-btn mp4"
                        aria-label={`Download ${video.title} as MP4`}
                        style={{ minWidth: 90 }}
                    >
                        {mp4State?.downloading ? `${mp4State.progress != null ? `${mp4State.progress}%` : 'Downloading...'}` : 'MP4'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VideoCard;
