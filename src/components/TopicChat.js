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
  FaceSmileIcon
} from '@heroicons/react/24/outline';
import { ref, onValue, push, update, serverTimestamp } from 'firebase/database';
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
    <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center" onClick={onClose}>
      <button 
        className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full"
        onClick={onClose}
      >
        <XMarkIcon className="h-6 w-6" />
      </button>
      <img 
        src={image} 
        alt="Full size" 
        className="max-w-[90vw] max-h-[90vh] object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
};

const Message = ({ message, isOwnMessage, user, onReply, onImageClick, messageRefs }) => {
  const timeString = formatTime(message.timestamp);
  const messageRef = useRef(null);

  useEffect(() => {
    if (messageRef.current) {
      messageRefs.current[message.id] = messageRef;
    }
  }, [message.id, messageRefs]);
  
  const handleReplyClick = () => {
    if (message.replyTo && messageRefs.current[message.replyTo.id]) {
      const element = messageRefs.current[message.replyTo.id].current;
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };
  
  return (
    <div 
      ref={messageRef}
      className={`flex items-start space-x-2 group ${isOwnMessage ? 'flex-row-reverse space-x-reverse' : ''} transition-all duration-300`}
    >
      <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'} max-w-[75%]`}>
        {message.replyTo && (
          <div 
            className={`
              text-xs mb-1 px-3 py-1.5 rounded-lg cursor-pointer hover:opacity-80 flex items-center space-x-2
              ${isOwnMessage 
                ? 'bg-blue-600/50 text-white' 
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }
            `}
            onClick={handleReplyClick}
          >
            <ArrowUturnLeftIcon className="h-3 w-3 shrink-0" />
            <span className="truncate">{message.replyTo.text || 'Media message'}</span>
          </div>
        )}
        <div className={`
          ${message.media ? '' : 'rounded-2xl px-4 py-2 shadow-sm relative group'}
          ${isOwnMessage && !message.media 
            ? 'bg-blue-500 text-white rounded-tr-none' 
            : message.media ? '' : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-tl-none'
          }
        `}>
          {message.media && (
            <div 
              className="rounded-lg overflow-hidden cursor-pointer"
              onClick={() => onImageClick(message.media.url)}
            >
              <img
                src={message.media.url}
                alt="Shared media"
                className="w-full max-h-[300px] object-cover rounded-lg"
                loading="lazy"
              />
            </div>
          )}
          {message.text && (
            <p className="text-sm sm:text-base whitespace-pre-wrap break-words">
              {message.text}
            </p>
          )}
          <button
            onClick={() => onReply(message)}
            className={`
              absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity
              ${isOwnMessage ? '-left-12' : '-right-12'}
              p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700
              text-gray-600 dark:text-gray-300
            `}
          >
            <ArrowUturnLeftIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center mt-1 space-x-2">
          <span className="text-xs text-gray-500">
            {timeString}
          </span>
        </div>
      </div>
    </div>
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!user?.uid || !topic?.id) return;
    
    localStorage.setItem(`lastRead_${topic.id}_${user.uid}`, Date.now().toString());
    localStorage.setItem(`lastChecked_${topic.id}_${user.uid}`, Date.now().toString());
    sessionStorage.setItem('openTopicChatId', topic.id);
    
    return () => {
      sessionStorage.removeItem('openTopicChatId');
    };
  }, [topic?.id, user?.uid]);

  useEffect(() => {
    if (!topic?.id || !partner?.uid) return;

    const chatRef = ref(rtdb, `topicChats/${topic.id}`);
    
    const unsubscribe = onValue(chatRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setMessages([]);
        setLoading(false);
        return;
      }

      localStorage.setItem(`lastRead_${topic.id}_${user.uid}`, Date.now().toString());

      const messagesList = Object.entries(data)
        .map(([id, message]) => ({
          id,
          ...message,
        }))
        .filter(message => 
          (message.userId === user.uid && message.partnerId === partner.uid) ||
          (message.userId === partner.uid && message.partnerId === user.uid)
        )
        .sort((a, b) => a.timestamp - b.timestamp);

      setMessages(messagesList);
      setLoading(false);
      setTimeout(scrollToBottom, 100);
    });

    return () => unsubscribe();
  }, [topic?.id, partner?.uid, user?.uid]);

  useEffect(() => {
    if (!user?.uid || !topic?.id) return;

    const typingRef = ref(rtdb, `typing/${topic.id}`);
    
    const unsubscribe = onValue(typingRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data[partner?.uid]) {
        setPartnerTyping(data[partner.uid].isTyping);
      } else {
        setPartnerTyping(false);
      }
    });

    return () => {
      unsubscribe();
      if (user?.uid) {
        update(ref(rtdb, `typing/${topic.id}/${user.uid}`), {
          isTyping: false,
          timestamp: serverTimestamp()
        });
      }
    };
  }, [user?.uid, topic?.id, partner?.uid]);

  const updateTypingStatus = (typing) => {
    if (!user?.uid || !topic?.id || !isOnline) return;

    update(ref(rtdb, `typing/${topic.id}/${user.uid}`), {
      isTyping: typing,
      timestamp: serverTimestamp()
    });
  };

  const handleMessageChange = (e) => {
    const message = e.target.value;
    setNewMessage(message);
    // Save draft to localStorage
    localStorage.setItem(`messageDraft_${topic.id}_${user?.uid}`, message);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    updateTypingStatus(true);

    typingTimeoutRef.current = setTimeout(() => {
      updateTypingStatus(false);
    }, 2000);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      validateFile(file);
      setSelectedFile(file);
      
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreviewUrl(reader.result);
        };
        reader.readAsDataURL(file);
      } else {
        setPreviewUrl(null);
      }
    } catch (error) {
      setError(error.message);
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleMediaOptionClick = (inputRef) => {
    inputRef.current?.click();
    setShowMediaMenu(false);
  };

  const handleReply = (message) => {
    setReplyingTo(message);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedFile) || !isOnline || !partner?.uid) return;

    try {
      let mediaData = null;
      if (selectedFile) {
        setUploadingMedia(true);
        mediaData = await uploadMedia(selectedFile);
      }

      const chatRef = ref(rtdb, `topicChats/${topic.id}`);
      const messageData = {
        text: newMessage.trim(),
        userId: user.uid,
        partnerId: partner.uid,
        userName: user.displayName || 'User',
        timestamp: serverTimestamp(),
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
        ...(replyingTo && {
          replyTo: {
            id: replyingTo.id,
            text: replyingTo.text,
            userId: replyingTo.userId
          }
        })
      };

      await push(chatRef, messageData);

      if (partner?.uid) {
        const notificationRef = ref(rtdb, `notifications/${partner.uid}`);
        const notificationData = {
          type: 'chat_message',
          senderName: user.displayName || 'Your partner',
          topicTitle: topic.question,
          message: messageData.media ? 'Sent a media message' : newMessage.trim(),
          timestamp: serverTimestamp(),
          topicId: topic.id
        };
        
        await update(notificationRef, {
          [Date.now()]: notificationData
        });
      }

      // Clear the draft from localStorage after successful send
      localStorage.removeItem(`messageDraft_${topic.id}_${user?.uid}`);
      
      setNewMessage('');
      setSelectedFile(null);
      setPreviewUrl(null);
      setReplyingTo(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      scrollToBottom();
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please try again.');
      setTimeout(() => setError(null), 3000);
    } finally {
      setUploadingMedia(false);
    }
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (mediaMenuRef.current && !mediaMenuRef.current.contains(event.target)) {
        setShowMediaMenu(false);
      }
      if (!event.target.closest('.emoji-picker-container') && 
          !event.target.closest('.emoji-button')) {
        setShowEmojiPicker(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const onEmojiClick = (emojiObject) => {
    const input = inputRef.current;
    const cursorPosition = input.selectionStart;
    const textBeforeCursor = newMessage.slice(0, cursorPosition);
    const textAfterCursor = newMessage.slice(cursorPosition);
    const updatedText = textBeforeCursor + emojiObject.emoji + textAfterCursor;
    
    setNewMessage(updatedText);
    
    // Store the target cursor position
    const newCursorPosition = cursorPosition + emojiObject.emoji.length;
    
    // Focus and set cursor position after state update
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(newCursorPosition, newCursorPosition);
    });

    // Keep emoji picker open
    setTimeout(() => {
      setShowEmojiPicker(true);
    }, 0);
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

  // Add cleanup effect
  useEffect(() => {
    return () => {
      // Clear draft when component unmounts
      if (!newMessage.trim()) {
        localStorage.removeItem(`messageDraft_${topic.id}_${user?.uid}`);
      }
    };
  }, [topic.id, user?.uid, newMessage]);

  if (loading) {
    return <div className="text-center py-4">Loading messages...</div>;
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-900 w-full max-w-3xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
              {topic.question}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white dark:bg-gray-900">
          {messages.map((message) => (
            <Message
              key={message.id}
              message={message}
              isOwnMessage={message.userId === user.uid}
              user={user}
              onReply={handleReply}
              onImageClick={setViewingImage}
              messageRefs={messageRefs}
            />
          ))}
          {partnerTyping && (
            <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400 animate-fade-in">
              <span className="text-sm">Partner is typing</span>
              <div className="flex space-x-1">
                <span className="w-1.5 h-1.5 bg-primary-400 dark:bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-1.5 h-1.5 bg-primary-400 dark:bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></span>
                <span className="w-1.5 h-1.5 bg-primary-400 dark:bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '400ms' }}></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply Preview */}
        {replyingTo && (
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ArrowUturnLeftIcon className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  Replying to {replyingTo.userId === user.uid ? 'yourself' : 'partner'}
                </span>
              </div>
              <button
                onClick={() => setReplyingTo(null)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-1 text-sm text-gray-500 dark:text-gray-400 truncate">
              {replyingTo.text || 'Media message'}
            </div>
          </div>
        )}

        {/* Media Preview */}
        {selectedFile && (
          <div className="p-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between bg-white dark:bg-gray-700 rounded-lg p-2 shadow-sm">
              <div className="flex items-center space-x-3">
                {previewUrl ? (
                  <img 
                    src={previewUrl} 
                    alt="Preview" 
                    className="h-16 w-16 object-cover rounded-lg"
                    onError={(e) => {
                      console.error('Image preview error');
                      e.target.src = '';
                      setError('Failed to load image preview');
                    }}
                  />
                ) : (
                  <DocumentIcon className="h-16 w-16 text-gray-400" />
                )}
                <span className="text-sm text-gray-700 dark:text-gray-200 truncate max-w-[200px]">
                  {selectedFile.name}
                </span>
              </div>
              <button
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
                className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-600"
              >
                <XCircleIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* Message Input */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          {error && (
            <div className="mb-2 text-center text-red-500 text-sm">{error}</div>
          )}
          <form onSubmit={handleSendMessage} className="flex items-end space-x-2">
            <div className="relative flex space-x-1">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
                accept="image/*"
              />
              <input
                type="file"
                ref={cameraInputRef}
                onChange={handleFileSelect}
                className="hidden"
                accept="image/*"
                capture="environment"
              />
              <button
                type="button"
                onClick={() => setShowMediaMenu(!showMediaMenu)}
                disabled={!isOnline || uploadingMedia}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                <PhotoIcon className="h-6 w-6" />
              </button>

              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors emoji-button"
              >
                <FaceSmileIcon className="h-6 w-6" />
              </button>
              
              {showMediaMenu && (
                <div 
                  ref={mediaMenuRef}
                  className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg py-1 min-w-[200px] border border-gray-200 dark:border-gray-700"
                >
                  <button
                    type="button"
                    onClick={() => handleMediaOptionClick(fileInputRef)}
                    className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-3"
                  >
                    <PhotoIcon className="h-5 w-5" />
                    <span>Upload Photo</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCameraClick}
                    className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-3"
                  >
                    <CameraIcon className="h-5 w-5" />
                    <span>Take Photo</span>
                  </button>
                </div>
              )}

              {showEmojiPicker && (
                <div className="absolute bottom-full left-0 mb-2 emoji-picker-container">
                  <div className="shadow-lg rounded-lg overflow-hidden">
                    <EmojiPicker
                      onEmojiClick={onEmojiClick}
                      theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
                    />
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={newMessage}
                onChange={handleMessageChange}
                placeholder="Type a message..."
                className="w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-full border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent px-4 py-2 text-base placeholder-gray-500 dark:placeholder-gray-400"
                disabled={!isOnline || uploadingMedia}
              />
            </div>
            
            <button
              type="submit"
              disabled={(!newMessage.trim() && !selectedFile) || !isOnline || uploadingMedia}
              className="p-2 text-white bg-blue-500 hover:bg-blue-600 rounded-full disabled:opacity-50 disabled:hover:bg-blue-500 transition-colors"
            >
              {uploadingMedia ? (
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent" />
              ) : (
                <PaperAirplaneIcon className="h-6 w-6 transform rotate-90" />
              )}
            </button>
          </form>
          {!isOnline && (
            <p className="text-xs text-red-500 mt-2 text-center">
              You are currently offline. Messages cannot be sent.
            </p>
          )}
        </div>

        {/* Image Viewer Modal */}
        {viewingImage && (
          <ImageViewer 
            image={viewingImage} 
            onClose={() => setViewingImage(null)} 
          />
        )}
      </div>
    </div>
  );
};

export default TopicChat; 

