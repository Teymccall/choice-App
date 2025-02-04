import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

const ImageViewer = ({ image, onClose }) => {
  return (
    <div 
      className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center" 
      onClick={onClose}
    >
      <button 
        className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <XMarkIcon className="h-6 w-6" />
      </button>
      <img 
        src={image} 
        alt="Full size" 
        className="max-w-[90vw] max-h-[90vh] object-contain"
        loading="eager"
        decoding="sync"
        onLoad={(e) => {
          e.target.style.opacity = 1;
        }}
        style={{ opacity: 0, transition: 'opacity 0.2s ease-in-out' }}
      />
    </div>
  );
};

export default ImageViewer; 