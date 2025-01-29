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
  const [swipeX, setSwipeX] = useState(0);
  const touchStart = useRef(0);
  const swipeThreshold = 50;

  useEffect(() => {
    if (messageRef.current) {
      messageRefs.current[message.id] = messageRef;
    }
  }, [message.id, messageRefs]);

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
  };

  const handleTouchMove = (e) => {
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
    if (swipeX >= swipeThreshold) {
      onReply(message);
    }
    touchStart.current = 0;
    setSwipeX(0);
  };

  return (
    <div 
      ref={messageRef}
      className={`flex w-full mb-1.5 ${isOwnMessage ? 'justify-end' : 'justify-start'} transition-colors duration-200`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div 
        className={`flex flex-col max-w-[65%] relative transition-transform`}
        style={{ transform: `translateX(${swipeX}px)` }}
      >
        {message.replyTo && (
          <div 
            className={`
              text-[12.8px] mb-0.5 px-3 py-[4px] cursor-pointer flex flex-col
              ${isOwnMessage 
                ? 'bg-[#0b846d]/[0.08] text-[#0b846d]' 
                : 'bg-[#667781]/[0.08] text-[#667781]'
              }
              rounded-[7px] rounded-bl-none w-full hover:opacity-80 transition-opacity
            `}
            onClick={handleReplyClick}
          >
            <span className="font-medium">
              {message.replyTo.userId === user.uid ? 'You' : 'Partner'}
            </span>
            <span className="truncate opacity-80">
              {message.replyTo.text || 'Media message'}
            </span>
          </div>
        )}

        <div className={`
          relative group
          ${message.media ? 'rounded-lg overflow-hidden' : 'rounded-[7px]'}
          ${isOwnMessage 
            ? 'bg-[#e7ffdb] dark:bg-[#005c4b]' 
            : 'bg-white dark:bg-[#202c33]'
          }
          ${message.media ? '' : isOwnMessage ? 'rounded-tr-[4px]' : 'rounded-tl-[4px]'}
          shadow-sm
        `}>
          {/* Message tail */}
          <div className={`
            absolute top-0 w-3 h-3 overflow-hidden
            ${isOwnMessage ? '-right-[10px]' : '-left-[10px]'}
          `}>
            <div className={`
              w-4 h-4 transform rotate-45 origin-top-left
              ${isOwnMessage 
                ? 'bg-[#e7ffdb] dark:bg-[#005c4b] -translate-x-1/2' 
                : 'bg-white dark:bg-[#202c33] translate-x-1/2'
              }
            `}/>
          </div>

          <div className="px-[9px] py-[6px] min-w-[85px]">
            {message.media && (
              <div 
                className="rounded-lg overflow-hidden cursor-pointer -mx-[9px] -mt-[6px]"
                onClick={() => onImageClick(message.media.url)}
              >
                <img
                  src={message.media.url}
                  alt="Shared media"
                  className="w-full max-h-[300px] object-cover"
                  loading="lazy"
                />
              </div>
            )}
            {message.text && (
              <div className="flex flex-col">
                <p className={`text-[14.2px] whitespace-pre-wrap break-words leading-[19px] ${
                  isOwnMessage 
                    ? 'text-[#111b21] dark:text-[#e9edef]' 
                    : 'text-[#111b21] dark:text-[#e9edef]'
                }`}>
                  {message.text}
                </p>
                <div className="flex justify-end mt-1">
                  <span className="text-[11px] text-[#667781] dark:text-[#8696a0] leading-none">
                    {timeString}
                  </span>
                </div>
              </div>
            )}
          </div>
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

      try {
        const messagesList = Object.entries(data)
          .map(([id, message]) => ({
            id,
            ...message,
            timestamp: message.timestamp || Date.now() // Ensure timestamp exists
          }))
          .filter(message => 
            // Include messages where either user is the sender or receiver
            (message.userId === user.uid && message.partnerId === partner.uid) ||
            (message.userId === partner.uid && message.partnerId === user.uid)
          )
          .sort((a, b) => {
            // Ensure proper timestamp comparison
            const timestampA = typeof a.timestamp === 'number' ? a.timestamp : a.timestamp?.toMillis?.() || 0;
            const timestampB = typeof b.timestamp === 'number' ? b.timestamp : b.timestamp?.toMillis?.() || 0;
            return timestampA - timestampB;
          });

        console.log('Received messages:', messagesList.length); // Debug log
        setMessages(messagesList);
        setLoading(false);
        setTimeout(scrollToBottom, 100);
      } catch (err) {
        console.error('Error processing messages:', err);
        setError('Error loading messages. Please try refreshing.');
        setLoading(false);
      }
    }, (error) => {
      console.error('Error in chat listener:', error);
      setError('Error connecting to chat. Please check your connection.');
      setLoading(false);
    });

    return () => {
      try {
        unsubscribe();
      } catch (err) {
        console.error('Error cleaning up chat listener:', err);
      }
    };
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
    
    // Auto-resize textarea with smaller max height
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
    
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

  const handleMediaClick = () => {
    // Simple toggle of media menu
    setShowMediaMenu(prev => !prev);
    // Close emoji picker if open
    setShowEmojiPicker(false);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setError(null);
      setUploadingMedia(true);

      // Validate file first
      await validateFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
        setSelectedFile(file);
      };
      reader.readAsDataURL(file);
      
      // Close media menu
      setShowMediaMenu(false);
    } catch (error) {
      console.error('File validation error:', error);
      setError(error.message);
      setSelectedFile(null);
      setPreviewUrl(null);
    } finally {
      setUploadingMedia(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleReply = (message) => {
    setReplyingTo(message);
  };

  const handleSendMessage = async (e) => {
    // If event exists, prevent default behavior
    if (e) {
      e.preventDefault();
    }
    
    if ((!newMessage.trim() && !selectedFile) || !isOnline || !partner?.uid) return;

    // Store message text and reply info before clearing
    const messageText = newMessage.trim();
    const replyData = replyingTo ? {
      id: replyingTo.id,
      text: replyingTo.text,
      userId: replyingTo.userId
    } : null;
    
    // Clear input and states immediately
    setNewMessage('');
    setReplyingTo(null);
    localStorage.removeItem(`messageDraft_${topic.id}_${user?.uid}`);
    
    // Reset textarea height to original size
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
        text: messageText,
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
        ...(replyData && { replyTo: replyData })
      };

      await push(chatRef, messageData);

      if (partner?.uid) {
        const notificationRef = ref(rtdb, `notifications/${partner.uid}`);
        const notificationData = {
          type: 'chat_message',
          senderName: user.displayName || 'Your partner',
          topicTitle: topic.question,
          message: messageData.media ? 'Sent a media message' : messageText,
          timestamp: serverTimestamp(),
          topicId: topic.id
        };
        
        await update(notificationRef, {
          [Date.now()]: notificationData
        });
      }
      
      setSelectedFile(null);
      setPreviewUrl(null);
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

  // Add viewport height adjustment for mobile
  useEffect(() => {
    const adjustViewportHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    window.addEventListener('resize', adjustViewportHeight);
    window.addEventListener('orientationchange', adjustViewportHeight);
    adjustViewportHeight();

    return () => {
      window.removeEventListener('resize', adjustViewportHeight);
      window.removeEventListener('orientationchange', adjustViewportHeight);
    };
  }, []);

  if (loading) {
    return <div className="text-center py-4">Loading messages...</div>;
  }

  return (
    <div className="fixed inset-0 bg-[#efeae2] dark:bg-[#0c1317] z-50">
      <div className="h-full flex flex-col">
        {/* Header - now with sticky positioning */}
        <div className="sticky top-0 z-10 flex-none px-3 sm:px-4 py-2 bg-[#f0f2f5] dark:bg-[#202c33] border-b border-[#d1d7db] dark:border-[#2f3b44] flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
            <div className="flex flex-col min-w-0 flex-1">
              <h3 className="text-[15px] sm:text-[16px] font-medium text-[#111b21] dark:text-[#e9edef] leading-tight truncate">
                {partner?.displayName || 'Partner'}
              </h3>
              <p className="text-[12px] sm:text-[13px] text-[#667781] dark:text-[#8696a0] leading-tight mt-0.5 truncate">
                {topic.question}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex-none p-1.5 sm:p-2 text-[#54656f] hover:text-[#3b4a54] dark:text-[#aebac1] dark:hover:text-[#e9edef] rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors ml-2"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Messages - with adjusted height calculation */}
        <div className="flex-1 overflow-y-auto px-[3%] sm:px-[5%] py-3 sm:py-4 space-y-1 bg-[#efeae2] dark:bg-[#0c1317]">
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

        {/* Input area - now with sticky positioning */}
        <div className="sticky bottom-0 z-10 flex-none bg-[#f0f2f5] dark:bg-[#202c33] px-2 sm:px-4 py-2 relative">
          {replyingTo && (
            <div className="flex items-center justify-between bg-[#fff] dark:bg-[#2a3942] px-3 sm:px-4 py-2 -mb-1 mx-1 rounded-t-lg">
              <div className="flex items-start space-x-2 min-w-0 flex-1">
                <div className="w-0.5 h-full bg-[#00a884] self-stretch flex-none"/>
                <div className="flex flex-col min-w-0 py-0.5">
                  <span className="text-[#00a884] dark:text-[#00a884] text-[12px] sm:text-[13px] font-medium">
                    {replyingTo.userId === user.uid ? 'You' : 'Partner'}
                  </span>
                  <span className="text-[#667781] dark:text-[#8696a0] text-[12px] sm:text-[13px] truncate">
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
          
          <div className="relative flex items-start space-x-1 sm:space-x-2 mx-1">
            <div className="relative flex-none self-end">
              <button
                onClick={handleMediaClick}
                className="p-1.5 sm:p-2 text-[#54656f] hover:text-[#3b4a54] dark:text-[#aebac1] dark:hover:text-[#e9edef]"
                disabled={uploadingMedia}
              >
                {uploadingMedia ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#00a884]"></div>
                  </div>
                ) : (
                  <PhotoIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                )}
              </button>
            </div>

            <div className="flex-1 min-w-0">
              <textarea
                ref={inputRef}
                value={newMessage}
                onChange={handleMessageChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Type a message"
                className="w-full rounded-lg pl-3 sm:pl-4 pr-3 sm:pr-4 py-2 bg-white dark:bg-[#2a3942] focus:outline-none text-[14px] sm:text-[15px] text-[#111b21] dark:text-[#d1d7db] placeholder-[#667781] dark:placeholder-[#8696a0] resize-none overflow-y-auto"
                style={{ 
                  minHeight: '40px',
                  maxHeight: '100px'
                }}
              />
            </div>

            <div className="flex-none self-end">
              <button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() && !selectedFile}
                className="p-1.5 sm:p-2 text-[#54656f] hover:text-[#00a884] dark:text-[#aebac1] dark:hover:text-[#00a884] disabled:opacity-50 disabled:hover:text-[#54656f] dark:disabled:hover:text-[#aebac1]"
              >
                <PaperAirplaneIcon className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
            </div>
          </div>

          {/* Media menu */}
          {showMediaMenu && (
            <div 
              ref={mediaMenuRef}
              className="absolute bottom-full left-2 sm:left-4 mb-[2px] w-[186px] bg-white dark:bg-[#233138] rounded-lg shadow-lg overflow-hidden z-50"
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

          {/* Media Preview */}
          {selectedFile && (
            <div className="absolute bottom-full left-2 right-2 sm:left-4 sm:right-4 mb-2 bg-white dark:bg-[#233138] rounded-lg shadow-lg overflow-hidden">
              <div className="p-2 sm:p-3 flex items-center justify-between">
                <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                  {previewUrl && (
                    <img 
                      src={previewUrl} 
                      alt="Preview" 
                      className="h-14 w-14 sm:h-16 sm:w-16 object-cover rounded-lg flex-none"
                    />
                  )}
                  <span className="text-sm text-[#111b21] dark:text-[#e9edef] truncate">
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
                  className="p-1.5 text-[#54656f] hover:text-[#3b4a54] dark:text-[#aebac1] dark:hover:text-[#e9edef] rounded-full hover:bg-[#f0f2f5] dark:hover:bg-[#182229] flex-none ml-2"
                  disabled={uploadingMedia}
                >
                  <XCircleIcon className="h-5 w-5" />
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
        </div>
      </div>

      {/* Image Viewer Modal */}
      {viewingImage && (
        <ImageViewer 
          image={viewingImage} 
          onClose={() => setViewingImage(null)} 
        />
      )}
    </div>
  );
};

export default TopicChat; 

