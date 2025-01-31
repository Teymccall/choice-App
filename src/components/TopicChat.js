import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  PaperAirplaneIcon,
  XMarkIcon,
  UserCircleIcon,
  ChatBubbleLeftRightIcon,
  PhotoIcon,
  DocumentIcon,
  XCircleIcon,
  CameraIcon,
  ArrowUturnLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FaceSmileIcon,
  CheckIcon,
  TrashIcon,
  PencilIcon,
  MicrophoneIcon
} from '@heroicons/react/24/outline';
import { ref, onValue, push, update, serverTimestamp, remove, get } from 'firebase/database';
import { rtdb } from '../firebase/config';
import { uploadMedia, validateFile } from '../utils/mediaUpload';
import cld from '../config/cloudinary';
import { AdvancedImage } from '@cloudinary/react';
import { fill } from '@cloudinary/url-gen/actions/resize';
import EmojiPicker from 'emoji-picker-react';

const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp.toDate?.() || new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

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

const Message = ({ message, isOwnMessage, user, onReply, onImageClick, messageRefs, onDelete, onEdit, onStartEdit }) => {
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
  const [isDeleted, setIsDeleted] = useState(message.isDeleted || false);

  useEffect(() => {
    setIsDeleted(message.isDeleted || false);
  }, [message.isDeleted]);

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
    e.stopPropagation(); // Prevent event bubbling
    if (message.replyTo && messageRefs.current[message.replyTo.id]) {
      const element = messageRefs.current[message.replyTo.id].current;
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Add a temporary highlight effect
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
    }, 500); // 500ms for long press
  };

  const handleTouchMove = (e) => {
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current);
    }
    if (!touchStart.current) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - touchStart.current;
    
    // Only allow right swipe (positive diff)
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

  // Render read receipt icons
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
    <>
      <div 
        ref={messageRef}
        className={`flex w-full mb-1.5 ${isOwnMessage ? 'justify-end' : 'justify-start'} transition-colors duration-200`}
      >
        <div 
          className={`flex flex-col max-w-[65%] relative transition-transform`}
          style={{ transform: `translateX(${swipeX}px)` }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onContextMenu={(e) => {
            e.preventDefault();
            if (!isDeleted) {
              setShowDeleteModal(true);
            }
          }}
        >
          {message.replyTo && (
            <div className={`
              ${isOwnMessage 
                ? 'bg-[#dcf8c6]' 
                : 'bg-white'
              } rounded-t-[7px] overflow-hidden
            `}>
              {renderReplyContent()}
            </div>
          )}

          <div className={`
            relative group
            ${message.media && !isDeleted ? 'rounded-lg overflow-hidden' : message.replyTo ? 'rounded-b-[7px]' : 'rounded-[7px]'}
            ${isOwnMessage 
              ? isDeleted ? 'bg-[#f0f0f0]' : 'bg-[#dcf8c6]'
              : isDeleted ? 'bg-[#f0f0f0]' : 'bg-white'
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
                  ? 'bg-[#dcf8c6] -translate-x-1/2' 
                  : 'bg-white translate-x-1/2'
                }
              `}/>
            </div>

            <div className="px-[9px] py-[6px] min-w-[85px]">
              {isDeleted ? (
                <div className="flex items-center space-x-2">
                  <span className="text-[14.2px] text-gray-500 italic">
                    This message was deleted
                  </span>
                  <span className="text-[11px] text-gray-500 leading-none">
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
                            className="flex-1 bg-transparent border-none focus:ring-0 p-0 text-[14.2px] resize-none max-h-[150px] min-h-[19px]"
                            style={{
                              height: 'auto',
                              minHeight: '19px'
                            }}
                          />
                          <button
                            onClick={handleEdit}
                            className="text-blue-500 hover:text-blue-600"
                          >
                            <CheckIcon className="h-5 w-5" />
                          </button>
                        </div>
                      ) : (
                        <p className={`text-[14.2px] whitespace-pre-wrap break-words leading-[19px] text-[#303030]`}>
                          {message.text}
                          {message.edited && (
                            <span className="text-[11px] text-[#667781] ml-1">
                              (edited)
                            </span>
                          )}
                        </p>
                      )}
                      <div className="flex justify-end items-center mt-1 space-x-1">
                        <span className="text-[11px] text-[#667781] leading-none">
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

      {/* Delete/Edit Modal */}
      {showDeleteModal && !isDeleted && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center px-4">
          <div className="bg-white dark:bg-[#2a3942] rounded-lg shadow-xl max-w-sm w-full overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Message Options
              </h3>
            </div>
            <div className="p-4 space-y-4">
              <button
                onClick={() => {
                  onReply(message);
                  setShowDeleteModal(false);
                }}
                className="w-full px-4 py-2 text-left text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg flex items-center space-x-2"
              >
                <ArrowUturnLeftIcon className="h-5 w-5" />
                <span>Reply</span>
              </button>
              {isOwnMessage && message.text && (
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    onStartEdit(message);
                  }}
                  className="w-full px-4 py-2 text-left text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg flex items-center space-x-2"
                >
                  <PencilIcon className="h-5 w-5" />
                  <span>Edit message</span>
                </button>
              )}
              {isOwnMessage && (
                <button
                  onClick={() => handleDelete(true)}
                  className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg flex items-center space-x-2"
                >
                  <TrashIcon className="h-5 w-5" />
                  <span>Delete for everyone</span>
                </button>
              )}
              <button
                onClick={() => handleDelete(false)}
                className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/20 rounded-lg flex items-center space-x-2"
              >
                <TrashIcon className="h-5 w-5" />
                <span>Delete for me</span>
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/20 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const TopicChat = ({ topic, onClose }) => {
  const { user, partner, isOnline } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState(() => {
    // Initialize with saved draft if it exists
    const savedDraft = localStorage.getItem(`messageDraft_${topic.id}_${user?.uid}`);
    return savedDraft || '';
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [viewingImage, setViewingImage] = useState(null);
  const [showMediaMenu, setShowMediaMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaMenuRef = useRef(null);
  const cameraInputRef = useRef(null);
  const messageRefs = useRef({});
  const inputRef = useRef(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!user?.uid || !topic?.id) return;
    
    // Store the current chat ID in session storage
    localStorage.setItem(`lastRead_${topic.id}_${user.uid}`, Date.now().toString());
    localStorage.setItem(`lastChecked_${topic.id}_${user.uid}`, Date.now().toString());
    sessionStorage.setItem('openTopicChatId', topic.id);
    
    // Only remove session storage if we're actually closing the chat
    // not just during component cleanup on refresh
    return () => {
      if (!window.performance.getEntriesByType('navigation').some(entry => entry.type === 'reload')) {
      sessionStorage.removeItem('openTopicChatId');
      }
    };
  }, [topic?.id, user?.uid]);

  useEffect(() => {
    if (!topic?.id || !partner?.uid || !user?.uid) return;

    const chatRef = ref(rtdb, `topicChats/${topic.id}`);
    const deletedMessagesRef = ref(rtdb, `deletedMessages/${user.uid}/${topic.id}`);
    
    const unsubscribe = onValue(chatRef, async (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setMessages([]);
        setLoading(false);
        return;
      }

      // Get deleted messages for current user
      const deletedSnapshot = await get(deletedMessagesRef);
      const deletedMessages = deletedSnapshot.val() || {};

      // Update messages list
      const messagesList = Object.entries(data)
        .map(([id, message]) => ({
          id,
          ...message,
          timestamp: message.timestamp || Date.now(),
          isDeleted: !!deletedMessages[id] // Mark message as deleted if it exists in deletedMessages
        }))
        .filter(message => 
          (message.userId === user.uid && message.partnerId === partner.uid) ||
          (message.userId === partner.uid && message.partnerId === user.uid)
        )
        .sort((a, b) => {
          const timestampA = typeof a.timestamp === 'number' ? a.timestamp : a.timestamp?.toMillis?.() || 0;
          const timestampB = typeof b.timestamp === 'number' ? b.timestamp : b.timestamp?.toMillis?.() || 0;
          return timestampA - timestampB;
        });

      setMessages(messagesList);
      setLoading(false);
      setTimeout(scrollToBottom, 100);
    });

    // Listen for changes in deleted messages
    const deletedUnsubscribe = onValue(deletedMessagesRef, (snapshot) => {
      const deletedData = snapshot.val() || {};
      setMessages(prevMessages => 
        prevMessages.map(msg => ({
          ...msg,
          isDeleted: !!deletedData[msg.id]
        }))
      );
    });

    return () => {
      unsubscribe();
      deletedUnsubscribe();
    };
  }, [topic?.id, partner?.uid, user?.uid]);

  useEffect(() => {
    if (!user?.uid || !topic?.id) {
      console.log('Cannot setup typing listener:', {
        hasUser: !!user?.uid,
        hasTopicId: !!topic?.id,
        partnerId: partner?.uid
      });
      return;
    }

    const typingRef = ref(rtdb, `typing/${topic.id}`);
    console.log('Setting up typing listener for topic:', {
      topicId: topic.id,
      path: `typing/${topic.id}`,
      partnerId: partner?.uid
    });
    
    const unsubscribe = onValue(typingRef, (snapshot) => {
      const data = snapshot.val();
      console.log('Typing status changed:', {
        data,
        partnerId: partner?.uid,
        partnerTyping: data?.[partner?.uid]?.isTyping,
        rawData: JSON.stringify(data)
      });
      
      if (data && data[partner?.uid]) {
        setPartnerTyping(data[partner.uid].isTyping);
      } else {
        setPartnerTyping(false);
      }
    });

    return () => {
      console.log('Cleaning up typing listener');
      unsubscribe();
      if (user?.uid) {
        update(ref(rtdb, `typing/${topic.id}/${user.uid}`), {
          isTyping: false,
          timestamp: serverTimestamp()
        }).then(() => {
          console.log('Successfully cleared typing status on cleanup');
        }).catch((error) => {
          console.error('Error clearing typing status:', error);
        });
      }
    };
  }, [user?.uid, topic?.id, partner?.uid]);

  const updateTypingStatus = (typing) => {
    console.log('Attempting to update typing status:', {
      typing,
      hasUser: !!user?.uid,
      hasTopicId: !!topic?.id,
      isOnline,
      partnerId: partner?.uid
    });

    if (!user?.uid || !topic?.id || !isOnline) {
      console.log('Cannot update typing status:', { 
        hasUser: !!user?.uid, 
        hasTopicId: !!topic?.id, 
        isOnline 
      });
      return;
    }

    console.log('Updating typing status:', {
      typing,
      userId: user.uid,
      topicId: topic.id,
      path: `typing/${topic.id}/${user.uid}`
    });

    update(ref(rtdb, `typing/${topic.id}/${user.uid}`), {
      isTyping: typing,
      timestamp: serverTimestamp()
    }).then(() => {
      console.log('Successfully updated typing status');
    }).catch((error) => {
      console.error('Error updating typing status:', error);
    });
  };

  const handleMessageChange = (e) => {
    const message = e.target.value;
    setNewMessage(message);
    
    // Auto-resize textarea with smaller max height
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
    
    // Save draft to localStorage
    localStorage.setItem(`messageDraft_${topic.id}_${user?.uid}`, message);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    console.log('Message changed, setting typing status to true');
    updateTypingStatus(true);

    typingTimeoutRef.current = setTimeout(() => {
      console.log('Typing timeout, setting typing status to false');
      updateTypingStatus(false);
    }, 2000);
  };

  const handleMediaClick = () => {
    setShowMediaMenu(prev => !prev);
    setShowEmojiPicker(false);
  };

  const handleCameraClick = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      const videoElement = document.createElement('video');
      videoElement.srcObject = stream;
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      // Wait for video to be ready
      await new Promise(resolve => videoElement.onloadedmetadata = resolve);
      
      // Set canvas size to match video
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      
      // Create a temporary container for the camera UI
      const container = document.createElement('div');
      container.className = 'fixed inset-0 bg-black z-[60] flex flex-col items-center justify-center';
      
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.className = 'w-full h-full object-cover';
      
      const captureButton = document.createElement('button');
      captureButton.className = 'absolute bottom-8 left-1/2 -translate-x-1/2 bg-white rounded-full p-4 shadow-lg';
      captureButton.innerHTML = '<div class="w-12 h-12 rounded-full border-4 border-gray-800"></div>';
      
      const closeButton = document.createElement('button');
      closeButton.className = 'absolute top-4 right-4 text-white p-2';
      closeButton.innerHTML = '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
      
      container.appendChild(video);
      container.appendChild(captureButton);
      container.appendChild(closeButton);
      document.body.appendChild(container);
      
      const cleanup = () => {
        stream.getTracks().forEach(track => track.stop());
        container.remove();
      };
      
      closeButton.onclick = cleanup;
      
      captureButton.onclick = () => {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(async (blob) => {
          const file = new File([blob], 'camera-photo.jpg', { type: 'image/jpeg' });
          setSelectedFile(file);
          const reader = new FileReader();
          reader.onloadend = () => setPreviewUrl(reader.result);
          reader.readAsDataURL(file);
          cleanup();
        }, 'image/jpeg');
      };
    } catch (error) {
      console.error('Camera access error:', error);
      // Fallback to file input if camera access fails
      cameraInputRef.current?.click();
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setError(null);

      // Create preview URL first, before validation or upload
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
        setSelectedFile(file);
      };
      reader.readAsDataURL(file);

      // Validate file after setting preview
      await validateFile(file);
      
      // Close media menu
      setShowMediaMenu(false);
    } catch (error) {
      console.error('File validation error:', error);
      setError(error.message);
      setSelectedFile(null);
      setPreviewUrl(null);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleReply = (message) => {
    setReplyingTo(message);
  };

  const startEditing = (message) => {
    setEditingMessage(message);
    setNewMessage(message.text);
    setShowMediaMenu(false);
    setShowEmojiPicker(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleSendMessage = async (e) => {
    if (e) {
      e.preventDefault();
    }
    
    const messageText = newMessage.trim();
    if (!messageText && !selectedFile) return;

    if (editingMessage) {
      await handleEditMessage(editingMessage.id, messageText);
      return;
    }

    if (!isOnline || !partner?.uid) return;

    // Store message text and reply info before clearing
    const replyData = replyingTo ? {
      id: replyingTo.id,
      text: replyingTo.text,
      userId: replyingTo.userId
    } : null;
    
    // Clear input and states immediately
    setNewMessage('');
    setReplyingTo(null);
    localStorage.removeItem(`messageDraft_${topic.id}_${user?.uid}`);
    
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = '42px';
    }

    try {
      let mediaData = null;
      if (selectedFile) {
        setUploadingMedia(true);
        mediaData = await uploadMedia(selectedFile);
      }

      const chatRef = ref(rtdb, `topicChats/${topic.id}`);
      const messageData = {
        text: messageText || '',
        userId: user.uid,
        partnerId: partner.uid,
        userName: user.displayName || 'User',
        timestamp: serverTimestamp(),
        delivered: false,
        read: false,
        ...(mediaData && {
          media: {
            url: mediaData.url,
            type: selectedFile.type,
            name: selectedFile.name,
            publicId: mediaData.publicId,
            resourceType: mediaData.resourceType,
            format: mediaData.format
          }
        }),
        ...(replyData && { replyTo: replyData })
      };

      const newMessageRef = await push(chatRef, messageData);

      if (isOnline) {
        update(ref(rtdb, `topicChats/${topic.id}/${newMessageRef.key}`), {
          delivered: true
        });
      }

      // Clear media states
      if (selectedFile) {
      setSelectedFile(null);
      setPreviewUrl(null);
        setUploadingMedia(false);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please try again.');
      setTimeout(() => setError(null), 3000);
    }
  };

  const cancelEditing = () => {
    setEditingMessage(null);
    setNewMessage('');
    if (inputRef.current) {
      inputRef.current.style.height = '42px';
    }
  };

  const handleDeleteMessage = async (messageId, deleteForEveryone) => {
    try {
      const chatRef = ref(rtdb, `topicChats/${topic.id}/${messageId}`);
      
      if (deleteForEveryone) {
        // Delete message completely
        await remove(chatRef);
        // Update local state immediately
        setMessages(prevMessages => prevMessages.filter(msg => msg.id !== messageId));
      } else {
        // Add this message ID to user's deleted messages
        const userDeletedRef = ref(rtdb, `deletedMessages/${user.uid}/${topic.id}`);
        await update(userDeletedRef, {
          [messageId]: serverTimestamp()
        });
        // Update local state immediately
        setMessages(prevMessages => prevMessages.filter(msg => msg.id !== messageId));
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      setError('Failed to delete message. Please try again.');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleEditMessage = async (messageId, newText) => {
    try {
      const messageRef = ref(rtdb, `topicChats/${topic.id}/${messageId}`);
      await update(messageRef, {
        text: newText,
        edited: true,
        editedAt: serverTimestamp()
      });
      // Clear input and reset states after successful edit
      setNewMessage('');
      setEditingMessage(null);
      if (inputRef.current) {
        inputRef.current.style.height = '42px';
      }
    } catch (error) {
      console.error('Error editing message:', error);
      setError('Failed to edit message. Please try again.');
      setTimeout(() => setError(null), 3000);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Check for supported MIME types
      const mimeType = 'audio/webm;codecs=opus';
      const options = { mimeType };
      
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        try {
          setUploadingMedia(true);
          
          // Create audio blob
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          const file = new File([audioBlob], 'voice-message.webm', { type: mimeType });

          // Upload to Cloudinary
          const mediaData = await uploadMedia(file);
          
          // Create message with audio
          const chatRef = ref(rtdb, `topicChats/${topic.id}`);
          const messageData = {
            userId: user.uid,
            partnerId: partner.uid,
            userName: user.displayName || 'User',
            timestamp: serverTimestamp(),
            delivered: false,
            read: false,
            media: {
              url: mediaData.url,
              type: 'audio/webm',
              name: 'Voice message',
              publicId: mediaData.publicId,
              resourceType: 'video', // Cloudinary treats audio as video resource
              format: 'webm',
              duration: recordingDuration
            }
          };

          // Send message
          const newMessageRef = await push(chatRef, messageData);

          if (isOnline) {
            update(ref(rtdb, `topicChats/${topic.id}/${newMessageRef.key}`), {
              delivered: true
            });
          }
        } catch (error) {
          console.error('Error sending voice message:', error);
          setError('Failed to send voice message. Please try again.');
          setTimeout(() => setError(null), 3000);
        } finally {
          setUploadingMedia(false);
          // Clean up
        stream.getTracks().forEach(track => track.stop());
          setIsRecording(false);
          setRecordingDuration(0);
          clearInterval(recordingTimerRef.current);
        }
      };

      // Start recording with smaller timeslices for better data collection
      mediaRecorder.start(100); // Record in 100ms chunks
      setIsRecording(true);
      
      // Start duration timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error starting recording:', error);
      setError('Could not access microphone. Please check your permissions.');
      setTimeout(() => setError(null), 3000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      clearInterval(recordingTimerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      clearInterval(recordingTimerRef.current);
      setIsRecording(false);
      setRecordingDuration(0);
    }
  };

  // Add cleanup for recording when component unmounts
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [isRecording]);

  // Add this useEffect for keyboard handling
  useEffect(() => {
    const handleResize = () => {
      // Only update if we're on mobile
      if (window.innerWidth <= 768) {
        // Get actual viewport height
        const vh = window.innerHeight;
        document.documentElement.style.setProperty('--chat-height', `${vh}px`);
      }
    };

    // Initial setup
    handleResize();

    // Add event listeners
    window.addEventListener('resize', handleResize);
    window.addEventListener('focusin', (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
        // When keyboard opens, use window.innerHeight
        document.documentElement.style.setProperty('--chat-height', `${window.innerHeight}px`);
      }
    });

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Add click outside handler for media menu
  useEffect(() => {
    function handleClickOutside(event) {
      if (mediaMenuRef.current && !mediaMenuRef.current.contains(event.target) && 
          !event.target.closest('button[data-media-button="true"]')) {
        setShowMediaMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  if (loading) {
    return <div className="text-center py-4">Loading messages...</div>;
  }

  return (
    <div className="fixed inset-0 bg-[#efeae2] dark:bg-[#0c1317] z-50 flex flex-col h-[var(--chat-height)] max-h-[100%]">
      {/* Header - make it more compact on mobile */}
      <div className="flex-none px-3 py-2 bg-[#f0f2f5] dark:bg-[#202c33] border-b border-[#d1d7db] dark:border-[#2f3b44]">
        <div className="flex items-center justify-between">
          <div className="flex items-center min-w-0 flex-1 space-x-2">
            <button
              onClick={onClose}
              className="flex-none p-1 -ml-1 text-[#54656f] hover:text-[#3b4a54] dark:text-[#aebac1] dark:hover:text-[#e9edef] rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
            <div className="min-w-0 flex-1">
              <h3 className="text-[15px] font-medium text-[#111b21] dark:text-[#e9edef] leading-tight truncate">
                {partner?.displayName || 'Partner'}
                {isOnline && (
                  <span className="inline-flex ml-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span className="absolute w-2 h-2 bg-green-500 rounded-full animate-ping opacity-75"></span>
                  </span>
                )}
              </h3>
              <p className="text-[12px] text-[#667781] dark:text-[#8696a0] leading-tight mt-0.5 truncate">
                {topic.question}
              </p>
            </div>
          </div>
        </div>
        </div>

      {/* Messages - adjust padding and spacing */}
      <div className="flex-1 overflow-y-auto min-h-0 px-[3%] py-2 space-y-1">
          {messages.map((message) => (
            <Message
              key={message.id}
              message={message}
              isOwnMessage={message.userId === user.uid}
              user={user}
              onReply={handleReply}
              onImageClick={setViewingImage}
              messageRefs={messageRefs}
            onDelete={handleDeleteMessage}
            onEdit={handleEditMessage}
            onStartEdit={startEditing}
            />
          ))}
          {partnerTyping && (
            <div className="flex items-center space-x-2 text-[#667781] dark:text-[#8696a0] animate-fade-in">
              <span className="text-sm">Partner is typing</span>
              <div className="flex space-x-1">
                <span className="w-1.5 h-1.5 bg-[#667781] dark:bg-[#8696a0] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-1.5 h-1.5 bg-[#667781] dark:bg-[#8696a0] rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></span>
                <span className="w-1.5 h-1.5 bg-[#667781] dark:bg-[#8696a0] rounded-full animate-bounce" style={{ animationDelay: '400ms' }}></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

      {/* Input area - optimize for mobile */}
      <div className="flex-none bg-[#f0f2f5] dark:bg-[#202c33] px-2 py-2 relative">
        {editingMessage && (
          <div className="absolute left-0 right-0 -top-10 bg-blue-500 dark:bg-blue-600 px-4 py-2 flex items-center justify-between text-white">
            <span className="text-sm">Editing message</span>
            <button
              onClick={cancelEditing}
              className="p-1 hover:bg-white/10 rounded-full"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        )}
        {replyingTo && !editingMessage && (
          <div className="flex items-center justify-between bg-[#fff] dark:bg-[#2a3942] px-3 py-2 -mb-1 mx-1 rounded-t-lg">
              <div className="flex items-start space-x-2 min-w-0 flex-1">
                <div className="w-0.5 h-full bg-[#00a884] self-stretch flex-none"/>
                <div className="flex flex-col min-w-0 py-0.5">
                <span className="text-[#00a884] dark:text-[#00a884] text-[12px] font-medium">
                    {replyingTo.userId === user.uid ? 'You' : 'Partner'}
                  </span>
                <span className="text-[#667781] dark:text-[#8696a0] text-[12px] truncate">
                    {replyingTo.text || 'Media message'}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setReplyingTo(null)} 
                className="p-1 -mr-1 text-[#667781] dark:text-[#8696a0] hover:text-[#3b4a54] dark:hover:text-[#e9edef] flex-none"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          )}
        <div className="flex items-end space-x-2">
          <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-lg flex items-end">
            {/* Media button */}
            <div className="flex items-center px-1.5 py-1.5">
              <button
                type="button"
                data-media-button="true"
                onClick={handleMediaClick}
                className="p-1 text-[#54656f] hover:text-[#3b4a54] dark:text-[#aebac1] dark:hover:text-[#e9edef] rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors relative"
                disabled={uploadingMedia}
              >
                {uploadingMedia ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#00a884]"></div>
                ) : (
                  <PhotoIcon className="h-6 w-6" />
                )}
              </button>
          </div>

          {/* Media menu */}
          {showMediaMenu && (
            <div 
              ref={mediaMenuRef}
                className="absolute bottom-16 left-2 w-[186px] bg-white dark:bg-[#233138] rounded-lg shadow-lg overflow-hidden z-50"
            >
              <div className="py-[6px]">
                <label
                  className="flex items-center space-x-4 px-6 py-[13px] hover:bg-[#f0f2f5] dark:hover:bg-[#182229] cursor-pointer transition-colors"
                  onClick={() => {
                    fileInputRef.current?.click();
                    setShowMediaMenu(false);
                  }}
                >
                  <PhotoIcon className="h-5 w-5 text-[#54656f] dark:text-[#aebac1]" />
                  <span className="text-[15px] text-[#111b21] dark:text-[#e9edef]">Photos & Videos</span>
                </label>

                <button
                  onClick={() => {
                    handleCameraClick();
                    setShowMediaMenu(false);
                  }}
                  className="w-full flex items-center space-x-4 px-6 py-[13px] hover:bg-[#f0f2f5] dark:hover:bg-[#182229] transition-colors"
                  disabled={uploadingMedia}
                >
                  <CameraIcon className="h-5 w-5 text-[#54656f] dark:text-[#aebac1]" />
                  <span className="text-[15px] text-[#111b21] dark:text-[#e9edef]">Camera</span>
                </button>
              </div>
            </div>
          )}

            <textarea
              ref={inputRef}
              value={newMessage}
              onChange={handleMessageChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
                if (e.key === 'Escape' && editingMessage) {
                  cancelEditing();
                }
              }}
              placeholder={selectedFile ? "Add a caption..." : editingMessage ? "Edit message..." : "Type a message"}
              className="flex-1 max-h-[100px] min-h-[42px] px-2 py-2 bg-transparent border-none focus:ring-0 text-[15px] placeholder-[#3b4a54] dark:placeholder-[#8696a0] resize-none"
              style={{ height: '42px' }}
            />
            <div className="flex items-center px-1.5 py-1.5">
              <button
                type="button"
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                className="p-1 text-[#54656f] hover:text-[#3b4a54] dark:text-[#aebac1] dark:hover:text-[#e9edef] rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                disabled={uploadingMedia || selectedFile}
              >
                <MicrophoneIcon className={`h-6 w-6 ${isRecording ? 'text-red-500' : ''}`} />
              </button>
            </div>
          </div>
          {!isRecording && (
            <button
              onClick={handleSendMessage}
              disabled={(!newMessage.trim() && !selectedFile) || uploadingMedia}
              className={`p-2 rounded-full flex-none ${
                (!newMessage.trim() && !selectedFile) || uploadingMedia
                  ? 'text-[#8696a0] dark:text-[#8696a0]'
                  : 'text-white bg-[#00a884] hover:bg-[#06cf9c] dark:bg-[#00a884] dark:hover:bg-[#06cf9c]'
              }`}
            >
              {editingMessage ? (
                <CheckIcon className="h-6 w-6" />
              ) : (
                <PaperAirplaneIcon className="h-6 w-6" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Media Preview */}
      {selectedFile && (
        <div className="fixed inset-x-0 bottom-[60px] bg-white dark:bg-[#233138] shadow-lg overflow-hidden z-[55] border-t border-gray-200 dark:border-gray-700">
          <div className="p-3 flex items-center justify-between">
            <div className="flex items-center space-x-3 min-w-0 flex-1">
              <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <PhotoIcon className="h-6 w-6 text-gray-400 dark:text-gray-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {selectedFile.name}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewUrl(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
              className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                >
              <XCircleIcon className="h-6 w-6" />
                </button>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="absolute bottom-full left-2 right-2 sm:left-4 sm:right-4 mb-2 bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-200 p-2 sm:p-3 rounded-lg shadow-lg">
              {error}
            </div>
          )}

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Image Viewer Modal */}
      {viewingImage && (
        <ImageViewer 
          image={viewingImage} 
          onClose={() => setViewingImage(null)} 
        />
      )}

      {/* Add styles for mobile keyboard handling */}
      <style jsx global>{`
        @media (max-width: 768px) {
          body.keyboard-open {
            height: var(--chat-height);
            overflow: hidden;
          }
          
          textarea {
            font-size: 16px !important; /* Prevent iOS zoom */
          }
        }
        
        .audio-player {
          --webkit-appearance: none;
          background: transparent;
        }
        .audio-player::-webkit-media-controls-panel {
          background: transparent;
        }
        .audio-player::-webkit-media-controls-current-time-display,
        .audio-player::-webkit-media-controls-time-remaining-display {
          color: #667781;
        }
        .dark .audio-player::-webkit-media-controls-current-time-display,
        .dark .audio-player::-webkit-media-controls-time-remaining-display {
          color: #8696a0;
        }
      `}</style>
    </div>
  );
};

export default TopicChat; 

