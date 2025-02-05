import React, { useState, useEffect, useRef } from 'react';
import {
  CheckIcon,
  XMarkIcon,
  PhotoIcon,
  ChatBubbleLeftRightIcon,
  PencilIcon,
  TrashIcon,
  ClockIcon,
  EllipsisVerticalIcon,
  DocumentIcon
} from '@heroicons/react/24/outline';
import { CheckIcon as CheckIconSolid } from '@heroicons/react/24/solid';
import { formatTime } from '../utils/dateUtils';

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
  const [error, setError] = useState('');

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

  const handleDelete = async (deleteForEveryone = false) => {
    if (!isWithinDeleteWindow() && deleteForEveryone) {
      setError('Messages can only be deleted for everyone within 1 hour of sending');
      return;
    }
    await onDelete(message.id, deleteForEveryone);
    setShowMenu(false);
  };

  const startEdit = () => {
    onStartEdit(message);
    setShowMenu(false);
  };

  const renderMessageStatus = () => {
    if (!isOwnMessage) return null;

    if (message.read) {
      return (
        <div className="flex -space-x-1">
          <CheckIconSolid className="h-3.5 w-3.5 text-[#53bdeb]" />
          <CheckIconSolid className="h-3.5 w-3.5 text-[#53bdeb]" />
        </div>
      );
    } else if (message.delivered) {
      return (
        <div className="flex -space-x-1">
          <CheckIcon className="h-3.5 w-3.5 text-[#8696a0]" />
          <CheckIcon className="h-3.5 w-3.5 text-[#8696a0]" />
        </div>
      );
    } else if (message.sent) {
      return <CheckIcon className="h-3.5 w-3.5 text-[#8696a0]" />;
    } else {
      return <ClockIcon className="h-3.5 w-3.5 text-[#8696a0]" />;
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
      className={`relative flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-2`}
      onTouchStart={(e) => {
        touchStart.current = e.touches[0].clientX;
        longPressTimeout.current = setTimeout(() => {
          if ('vibrate' in navigator) {
            navigator.vibrate(50);
          }
          setShowMenu(true);
        }, 500);
      }}
      onTouchMove={(e) => {
        if (longPressTimeout.current) {
          clearTimeout(longPressTimeout.current);
        }
        const currentX = e.touches[0].clientX;
        const diff = currentX - touchStart.current;
        
        if (diff > 0 && diff <= swipeThreshold) {
          setSwipeX(diff);
        }
      }}
      onTouchEnd={() => {
        if (longPressTimeout.current) {
          clearTimeout(longPressTimeout.current);
        }
        if (swipeX >= swipeThreshold / 2) {
          onReply(message);
        }
        setSwipeX(0);
      }}
      onTouchCancel={() => {
        if (longPressTimeout.current) {
          clearTimeout(longPressTimeout.current);
        }
        setSwipeX(0);
      }}
      style={{
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        KhtmlUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent'
      }}
    >
      <div 
        className={`
          message-content relative max-w-[85%] w-fit
          ${isOwnMessage 
            ? 'bg-[#e7ffdb] dark:bg-[#005c4b]' 
            : 'bg-[#ffffff] dark:bg-[#202c33]'
          } 
          rounded-lg shadow-sm
        `}
      >
        {message.replyTo && (
          <div 
            className={`
              px-2 pt-1 pb-2 -mb-1 cursor-pointer
              ${isOwnMessage 
                ? 'bg-[#d9fdd3] dark:bg-[#025144]' 
                : 'bg-[#ffffff] dark:bg-[#1c262d]'
              }
              rounded-t-lg border-l-[3px] border-[#25d366] dark:border-[#00a884]
            `}
            onClick={handleReplyClick}
          >
            <div className="flex flex-col min-w-0">
              <span className="text-[#00a884] dark:text-[#00a884] text-[13px] font-medium">
                {message.replyTo.userId === user.uid ? 'You' : 'Partner'}
              </span>
              <span className="text-[#667781] dark:text-[#8696a0] text-[13px] truncate">
                {message.replyTo.text || 'Media message'}
              </span>
            </div>
          </div>
        )}

        <div 
          className={`
            relative px-[9px] py-[6px] min-w-[85px] max-w-full
            ${message.replyTo ? 'rounded-b-lg' : 'rounded-lg'}
            ${isOwnMessage 
              ? 'bg-[#d9fdd3] dark:bg-[#005c4b]' 
              : 'bg-[#ffffff] dark:bg-[#202c33]'
            }
          `}
        >
          {/* Message tail */}
          <div 
            className={`
              absolute top-0 w-3 h-3 overflow-hidden
              ${isOwnMessage ? '-right-[10px]' : '-left-[10px]'}
              ${message.replyTo ? 'top-[unset] bottom-0' : ''}
            `}
          >
            <div 
              className={`
                w-4 h-4 transform rotate-45 origin-top-left
                ${isOwnMessage 
                  ? 'bg-[#d9fdd3] dark:bg-[#005c4b] -translate-x-1/2' 
                  : 'bg-white dark:bg-[#202c33] translate-x-1/2'
                }
              `}
            />
          </div>

          {isDeleted || message.deletedForEveryone ? (
            <div className="flex items-center space-x-2">
              <span className="text-[14.2px] text-[#667781] dark:text-[#8696a0] italic">
                {message.deletedForEveryone 
                  ? message.deletedBy === user.uid 
                    ? "You deleted this message"
                    : "This message was deleted"
                  : "You deleted this message for yourself"}
              </span>
              <span className="text-[11px] text-[#667781] dark:text-[#8696a0] leading-none">
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
                  <p className="text-[14.2px] whitespace-pre-wrap break-words leading-[19px] text-[#111b21] dark:text-[#e9edef]">
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
                    {renderMessageStatus()}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Message Options Menu */}
      {showMenu && !isDeleted && (
        <>
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
          />
          
          <div 
            ref={menuRef}
            className="absolute z-50 bg-white dark:bg-[#233138] rounded-md shadow-lg overflow-hidden w-[180px]"
            style={{
              top: -10,
              right: isOwnMessage ? 0 : 'auto',
              left: isOwnMessage ? 'auto' : 0,
            }}
          >
            <div className="py-1">
              <button
                onClick={() => {
                  setShowMenu(false);
                  onReply(message);
                }}
                className="w-full px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center space-x-3"
              >
                <ChatBubbleLeftRightIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                <span className="text-[15px] text-gray-700 dark:text-gray-200">Reply</span>
              </button>

              {isOwnMessage && (
                <button
                  onClick={startEdit}
                  className="w-full px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center space-x-3"
                >
                  <PencilIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                  <span className="text-[15px] text-gray-700 dark:text-gray-200">Edit</span>
                </button>
              )}

              {isOwnMessage && (
                <button
                  onClick={() => handleDelete(true)}
                  className="w-full px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center space-x-3"
                >
                  <TrashIcon className="h-5 w-5 text-red-500" />
                  <span className="text-[15px] text-red-500">Delete for everyone</span>
                </button>
              )}

              <button
                onClick={() => handleDelete(false)}
                className="w-full px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center space-x-3"
              >
                <TrashIcon className="h-5 w-5 text-red-500" />
                <span className="text-[15px] text-red-500">Delete for me</span>
              </button>
            </div>
          </div>
        </>
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

export default Message; 