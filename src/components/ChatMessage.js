import React, { useEffect, useState } from 'react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { CheckIcon } from '@heroicons/react/24/solid';

const MessageStatus = ({ status }) => {
  if (!status) return null;

  switch (status) {
    case 'sent':
      return (
        <div className="message-status">
          <CheckIcon className="tick tick-sent" />
        </div>
      );
    case 'delivered':
      return (
        <div className="message-status">
          <CheckIcon className="tick tick-delivered" />
          <CheckIcon className="tick tick-delivered" />
        </div>
      );
    case 'read':
      return (
        <div className="message-status">
          <CheckIcon className="tick tick-read" />
          <CheckIcon className="tick tick-read" />
        </div>
      );
    default:
      return null;
  }
};

const ChatMessage = ({ message, isSent, timestamp, media, status }) => {
  const [showDownload, setShowDownload] = useState(false);

  const handleDownload = async (url, filename) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Error downloading media:', error);
    }
  };

  const renderMedia = () => {
    if (!media) return null;

    const isImage = media.type?.startsWith('image') || media.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    const isVideo = media.type?.startsWith('video') || media.url?.match(/\.(mp4|webm|ogg)$/i);

    return (
      <div 
        className="media-container"
        onMouseEnter={() => setShowDownload(true)}
        onMouseLeave={() => setShowDownload(false)}
      >
        {isImage && (
          <img src={media.url} alt="Shared content" loading="lazy" />
        )}
        {isVideo && (
          <video controls>
            <source src={media.url} type={media.type} />
            Your browser does not support the video tag.
          </video>
        )}
        <button 
          className={`media-download-btn ${showDownload ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => handleDownload(media.url, media.filename)}
          aria-label="Download media"
        >
          <ArrowDownTrayIcon className="h-5 w-5" />
        </button>
      </div>
    );
  };

  return (
    <div className={`message-container ${isSent ? 'flex justify-end' : 'flex justify-start'}`}>
      <div className={`${isSent ? 'message-sent' : 'message-received'}`}>
        {renderMedia()}
        {message && <div className="message-text">{message}</div>}
        <div className="message-info">
          <div className="message-time">
            {timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
          </div>
          {isSent && <MessageStatus status={status} />}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage; 