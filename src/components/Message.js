import React, { useState, useEffect, useRef } from 'react';
import { CheckIcon, XMarkIcon, PhotoIcon } from '@heroicons/react/24/outline';

const Message = ({ message, isOwnMessage, user, onReply, onImageClick, messageRefs, onDelete, onEdit, onStartEdit }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleted, setIsDeleted] = useState(message.deleted);
  const menuRef = useRef(null);
  const timeString = formatTime(message.timestamp);
  const messageRef = useRef(null);
  const [swipeX, setSwipeX] = useState(0);
  const touchStart = useRef(0);
  const swipeThreshold = 50;
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditInput, setShowEditInput] = useState(false);
  const [editedText, setEditedText] = useState(message.text);
  const editInputRef = useRef(null);
  const longPressTimeout = useRef(null);
  const [isLongPressed, setIsLongPressed] = useState(false);

  useEffect(() => {
    setIsDeleted(message.deleted);
  }, [message.deleted]);

  useEffect(() => {
    if (messageRef.current) {
      messageRefs.current[message.id] = messageRef;
    }
  }, [message.id, messageRefs]);

  useEffect(() => {
    if (showEditInput && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.setSelectionRange(editedText.length, editedText.length);
    }
  }, [showEditInput]);

  const handleReplyClick = (e) => {
    e.stopPropagation();
    if (message.replyTo && messageRefs.current[message.replyTo.id]) {
      const element = messageRefs.current[message.replyTo.id].current;
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('bg-primary-50', 'dark:bg-primary-900/20');
        setTimeout(() => {
          element.classList.remove('bg-primary-50', 'dark:bg-primary-900/20');
        }, 1000);
      }
    }
  };

  const handleTouchStart = (e) => {
    touchStart.current = e.touches[0].clientX;
    longPressTimeout.current = setTimeout(() => {
      setIsLongPressed(true);
      setShowDeleteModal(true);
    }, 500);
  };

  const handleTouchMove = (e) => {
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current);
    }
    if (!touchStart.current) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - touchStart.current;
    
    if (diff > 0) {
      const swipe = Math.min(diff, swipeThreshold);
      setSwipeX(swipe);
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current);
    }
    if (!isLongPressed && swipeX >= swipeThreshold) {
      onReply(message);
    }
    touchStart.current = 0;
    setSwipeX(0);
    setIsLongPressed(false);
  };

  const handleDelete = async (deleteForEveryone) => {
    setIsDeleted(true);
    await onDelete(message.id, deleteForEveryone);
    setShowDeleteModal(false);
  };

  const handleEdit = () => {
    if (editedText.trim() !== message.text) {
      onEdit(message.id, editedText.trim());
    }
    setShowEditInput(false);
  };

  const renderReadReceipt = () => {
    if (!isOwnMessage) return null;
    
    if (message.read) {
      return (
        <div className="flex -space-x-1">
          <CheckIcon className="h-3.5 w-3.5 text-blue-500" />
          <CheckIcon className="h-3.5 w-3.5 text-blue-500" />
        </div>
      );
    } else if (message.delivered) {
      return (
        <div className="flex -space-x-1">
          <CheckIcon className="h-3.5 w-3.5 text-gray-500" />
          <CheckIcon className="h-3.5 w-3.5 text-gray-500" />
        </div>
      );
    } else {
      return <CheckIcon className="h-3.5 w-3.5 text-gray-500" />;
    }
  };

  const renderMediaContent = () => {
    if (!message.media) return null;

    if (message.media.type.startsWith('audio')) {
      return (
        <div className="flex items-center space-x-2">
          <audio
            src={message.media.url}
            controls
            controlsList="nodownload noplaybackrate"
            preload="metadata"
            className="h-10 max-w-[200px] audio-player"
          />
          {message.media.duration && (
            <span className="text-[11px] text-[#667781] dark:text-[#8696a0]">
              {Math.floor(message.media.duration / 60)}:{(message.media.duration % 60).toString().padStart(2, '0')}
            </span>
          )}
        </div>
      );
    }

    return (
      <div 
        className="rounded-lg overflow-hidden cursor-pointer -mx-[9px] -mt-[6px] relative bg-black/5 dark:bg-white/5"
        onClick={() => onImageClick(message.media.url)}
      >
        <img
          src={message.media.url}
          alt="Shared media"
          className="w-full max-h-[300px] object-cover"
          loading="lazy"
          decoding="async"
          onLoad={(e) => {
            e.target.style.opacity = 1;
          }}
          style={{ opacity: 0, transition: 'opacity 0.2s ease-in-out' }}
        />
      </div>
    );
  };

  const renderReplyContent = () => {
    if (!message.replyTo) return null;
    
    return (
      <div 
        className={`
          text-[13px] -mb-1 px-2 pt-1 pb-2 cursor-pointer flex items-start space-x-2
          ${isOwnMessage 
            ? 'bg-[#dcf8c6] text-[#303030]' 
            : 'bg-white text-[#303030]'
          }
          rounded-t-[7px] hover:opacity-95 transition-opacity
        `}
        onClick={handleReplyClick}
      >
        <div className="w-0.5 h-full bg-[#25d366] self-stretch flex-none mr-2"/>
        <div className="flex-1 min-w-0">
          <span className="font-medium text-[#25d366] block text-[13px]">
            {message.replyTo.userId === user.uid ? 'You' : 'Partner'}
          </span>
          {message.replyTo.media ? (
            <div className="flex items-center space-x-2">
              <PhotoIcon className="h-4 w-4 flex-shrink-0 text-[#667781]" />
              <span className="truncate text-[#667781]">Photo</span>
            </div>
          ) : (
            <span className="block truncate text-[#667781]">
              {message.replyTo.text}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      ref={(el) => messageRefs.current[message.id] = el}
      className={`flex items-end space-x-2 group ${isOwnMessage ? 'flex-row-reverse space-x-reverse' : ''}`}
    >
      <div className={`relative max-w-[85%] ${isOwnMessage ? 'bg-[#d9fdd3] dark:bg-[#005c4b]' : 'bg-white dark:bg-[#202c33]'} rounded-lg px-2 py-[6px] shadow-sm`}>
        {message.replyTo && (
          <div className={`
            ${isOwnMessage ? 'bg-[#dcf8c6]' : 'bg-white'} rounded-t-[7px] overflow-hidden
          `}>
            {renderReplyContent()}
          </div>
        )}

        <div className={`
          relative group
          ${message.media && !isDeleted ? 'rounded-lg overflow-hidden' : message.replyTo ? 'rounded-b-[7px]' : 'rounded-[7px]'}
          ${isOwnMessage 
            ? isDeleted ? 'bg-[#f0f0f0] dark:bg-gray-700' : 'bg-[#dcf8c6] dark:bg-[#202c33]'
            : isDeleted ? 'bg-[#f0f0f0] dark:bg-gray-700' : 'bg-white dark:bg-[#202c33]'
          }
          ${message.media && !isDeleted ? '' : isOwnMessage ? 'rounded-tr-[4px]' : 'rounded-tl-[4px]'}
          shadow-sm
        `}>
          {/* Message tail */}
          <div className={`
            absolute top-0 w-3 h-3 overflow-hidden
            ${isOwnMessage ? '-right-[10px]' : '-left-[10px]'}
            ${isDeleted ? 'hidden' : ''}
            ${message.replyTo ? 'top-[unset] bottom-0' : ''}
          `}>
            <div className={`
              w-4 h-4 transform rotate-45 origin-top-left
              ${isOwnMessage 
                ? 'bg-[#dcf8c6] dark:bg-[#202c33] -translate-x-1/2' 
                : 'bg-white dark:bg-[#202c33] translate-x-1/2'
              }
            `}/>
          </div>

          <div className="px-[9px] py-[6px] min-w-[85px]">
            {isDeleted ? (
              <div className="flex items-center space-x-2">
                <span className="text-[14.2px] text-gray-500 dark:text-gray-400 italic">
                  This message was deleted
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 leading-none">
                  {timeString}
                </span>
              </div>
            ) : (
              <>
                {message.media && renderMediaContent()}
                {message.text && (
                  <div className="flex flex-col">
                    {showEditInput ? (
                      <div className="flex items-center space-x-2">
                        <textarea
                          ref={editInputRef}
                          value={editedText}
                          onChange={(e) => setEditedText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleEdit();
                            }
                            if (e.key === 'Escape') {
                              setShowEditInput(false);
                              setEditedText(message.text);
                            }
                          }}
                          className="flex-1 bg-transparent border-none focus:ring-0 p-0 text-[14.2px] resize-none max-h-[150px] min-h-[19px] text-[#303030] dark:text-white"
                          style={{
                            height: 'auto',
                            minHeight: '19px'
                          }}
                        />
                        <button
                          onClick={handleEdit}
                          className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          <CheckIcon className="h-5 w-5" />
                        </button>
                      </div>
                    ) : (
                      <p className={`text-[14.2px] whitespace-pre-wrap break-words leading-[19px] text-[#303030] dark:text-white`}>
                        {message.text}
                        {message.edited && (
                          <span className="text-[11px] text-[#667781] dark:text-[#8696a0] ml-1">
                            (edited)
                          </span>
                        )}
                      </p>
                    )}
                    <div className="flex justify-end items-center mt-1 space-x-1">
                      <span className="text-[11px] text-[#667781] dark:text-[#8696a0] leading-none">
                        {timeString}
                      </span>
                      {renderReadReceipt()}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp.toDate?.() || new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default Message; 