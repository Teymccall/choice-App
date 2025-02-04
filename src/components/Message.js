import React, { useState, useEffect, useRef } from 'react';
import { CheckIcon, XMarkIcon, PhotoIcon, ChatBubbleLeftRightIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

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
  const longPressTimeout = useRef(null);
  const [isLongPressed, setIsLongPressed] = useState(false);

  // Add time window checks
  const EDIT_TIME_WINDOW = 15 * 60 * 1000; // 15 minutes in milliseconds
  const DELETE_TIME_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds

  const isWithinEditWindow = () => {
    if (!message.timestamp) return false;
    const messageTime = typeof message.timestamp === 'number' 
      ? message.timestamp 
      : message.timestamp.toDate?.().getTime() || new Date(message.timestamp).getTime();
    return Date.now() - messageTime <= EDIT_TIME_WINDOW;
  };

  const isWithinDeleteWindow = () => {
    if (!message.timestamp) return false;
    const messageTime = typeof message.timestamp === 'number' 
      ? message.timestamp 
      : message.timestamp.toDate?.().getTime() || new Date(message.timestamp).getTime();
    return Date.now() - messageTime <= DELETE_TIME_WINDOW;
  };

  useEffect(() => {
    setIsDeleted(message.deleted);
  }, [message.deleted]);

  useEffect(() => {
    if (messageRef.current) {
      messageRefs.current[message.id] = messageRef;
    }
  }, [message.id, messageRefs]);

  useEffect(() => {
    if (showMenu) {
      const handleClickOutside = (event) => {
        if (menuRef.current && !menuRef.current.contains(event.target)) {
          setShowMenu(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showMenu]);

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
      setShowMenu(true);
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

  const handleTouchCancel = () => {
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current);
    }
    touchStart.current = 0;
    setSwipeX(0);
    setIsLongPressed(false);
  };

  const handleDelete = async (deleteForEveryone) => {
    setShowDeleteModal(false);
    await onDelete(message.id, deleteForEveryone);
  };

  const startEdit = () => {
    onStartEdit(message);
    setShowMenu(false);
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
      ref={messageRef}
      className={`flex items-end space-x-2 group px-[3%] sm:px-0 mb-1 ${isOwnMessage ? 'flex-row-reverse space-x-reverse' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      style={{ touchAction: 'none' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className={`relative max-w-[85%] w-fit ${isOwnMessage ? 'bg-[#d9fdd3] dark:bg-[#005c4b]' : 'bg-white dark:bg-[#202c33]'} rounded-lg shadow-sm`}>
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

          <div className="px-[9px] py-[6px] min-w-[85px] max-w-full">
            {isDeleted || message.deletedForEveryone ? (
              <div className="flex items-center space-x-2">
                <span className="text-[14.2px] text-gray-500 dark:text-gray-400 italic">
                  {message.deletedForEveryone 
                    ? message.deletedBy === user.uid 
                      ? "You deleted this message"
                      : "This message was deleted"
                    : "You deleted this message for yourself"}
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 leading-none">
                  {timeString}
                </span>
              </div>
            ) : (
              <>
                {message.media && (
                  <div className="max-w-[300px] sm:max-w-[350px] md:max-w-[400px]">
                    {renderMediaContent()}
                  </div>
                )}
                {message.text && (
                  <div className="flex flex-col max-w-[250px] sm:max-w-[300px] md:max-w-[400px]">
                    <p className="text-[14.2px] whitespace-pre-wrap break-words leading-[19px] text-[#303030] dark:text-white">
                      {message.text}
                      {message.edited && (
                        <span className="text-[11px] text-[#667781] dark:text-[#8696a0] ml-1">
                          (edited)
                        </span>
                      )}
                    </p>
                    <div className="flex justify-end items-center mt-1 space-x-1">
                      <span className="text-[11px] text-[#667781] dark:text-[#8696a0] leading-none flex-shrink-0">
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

      {/* Message Options Menu */}
      {showMenu && !isDeleted && (
        <div 
          ref={menuRef}
          className={`
            fixed z-50 bg-white dark:bg-[#233138] rounded-lg shadow-lg py-1 w-[180px]
            ${isOwnMessage ? 'right-4' : 'left-4'}
          `}
          style={{
            top: '50%',
            transform: 'translateY(-50%)',
            maxHeight: 'calc(100vh - 100px)',
            overflowY: 'auto'
          }}
        >
          <button
            onClick={() => {
              setShowMenu(false);
              onReply(message);
            }}
            className="w-full px-4 py-3 text-left hover:bg-[#f0f2f5] dark:hover:bg-[#182229] flex items-center space-x-3"
          >
            <ChatBubbleLeftRightIcon className="h-5 w-5 text-[#54656f] dark:text-[#aebac1] flex-shrink-0" />
            <span className="text-[15px] text-[#111b21] dark:text-[#e9edef]">Reply</span>
          </button>
          {isOwnMessage ? (
            <>
              {isWithinEditWindow() && (
                <button
                  onClick={() => {
                    setShowMenu(false);
                    startEdit();
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-[#f0f2f5] dark:hover:bg-[#182229] flex items-center space-x-3"
                >
                  <PencilIcon className="h-5 w-5 text-[#54656f] dark:text-[#aebac1] flex-shrink-0" />
                  <span className="text-[15px] text-[#111b21] dark:text-[#e9edef]">Edit</span>
                </button>
              )}
              <button
                onClick={() => {
                  setShowMenu(false);
                  handleDelete(false);
                }}
                className="w-full px-4 py-3 text-left hover:bg-[#f0f2f5] dark:hover:bg-[#182229] flex items-center space-x-3"
              >
                <TrashIcon className="h-5 w-5 text-red-500 flex-shrink-0" />
                <span className="text-[15px] text-red-500">Delete for me</span>
              </button>
              {isWithinDeleteWindow() && (
                <button
                  onClick={() => {
                    setShowMenu(false);
                    handleDelete(true);
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-[#f0f2f5] dark:hover:bg-[#182229] flex items-center space-x-3"
                >
                  <TrashIcon className="h-5 w-5 text-red-500 flex-shrink-0" />
                  <span className="text-[15px] text-red-500">Delete for everyone</span>
                </button>
              )}
            </>
          ) : (
            <button
              onClick={() => {
                setShowMenu(false);
                handleDelete(false);
              }}
              className="w-full px-4 py-3 text-left hover:bg-[#f0f2f5] dark:hover:bg-[#182229] flex items-center space-x-3"
            >
              <TrashIcon className="h-5 w-5 text-red-500 flex-shrink-0" />
              <span className="text-[15px] text-red-500">Delete for me</span>
            </button>
          )}
        </div>
      )}

      {/* Swipe indicator */}
      <div 
        className="absolute left-0 top-0 bottom-0 flex items-center pointer-events-none pl-2"
        style={{
          transform: `translateX(${swipeX}px)`,
          opacity: swipeX / swipeThreshold,
          transition: swipeX === 0 ? 'transform 0.2s ease-out' : 'none'
        }}
      >
        <div className="bg-[#00a884] dark:bg-[#00a884] rounded-full p-2 shadow-lg">
          <ChatBubbleLeftRightIcon className="h-5 w-5 text-white" />
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