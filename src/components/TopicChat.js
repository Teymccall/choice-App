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
  MicrophoneIcon,
  EllipsisVerticalIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';
import { ref, onValue, push, update, serverTimestamp, remove, get, set } from 'firebase/database';
import { rtdb } from '../firebase/config';
import { uploadMedia, validateFile } from '../utils/mediaUpload';
import cld from '../config/cloudinary';
import { AdvancedImage } from '@cloudinary/react';
import { fill } from '@cloudinary/url-gen/actions/resize';
import EmojiPicker from 'emoji-picker-react';
import ProfilePicture from './ProfilePicture';
import { getRelationshipLevel, RELATIONSHIP_LEVELS } from '../utils/relationshipLevels';
import ImageViewer from './ImageViewer';
import Message from './Message';

const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp.toDate?.() || new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
  const [partnerData, setPartnerData] = useState(partner);
  const [messageCount, setMessageCount] = useState(0);
  const [relationshipLevel, setRelationshipLevel] = useState({ level: 'Acquaintance', color: 'text-gray-600 dark:text-gray-400' });
  const [nextLevelProgress, setNextLevelProgress] = useState(0);
  const [isEditing, setIsEditing] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!user?.uid || !topic?.id) return;
    
    // Store the current chat ID in session storage
    localStorage.setItem(`lastRead_${topic.id}_${user.uid}`, Date.now().toString());
    localStorage.setItem(`lastChecked_${topic.id}_${user.uid}`, Date.now().toString());
    sessionStorage.setItem('openTopicChatId', topic.id);
    
    // Dispatch custom event for FloatingNav
    window.dispatchEvent(new Event('topicChatOpened'));
    
    // Only remove session storage if we're actually closing the chat
    // not just during component cleanup on refresh
    return () => {
      if (!window.performance.getEntriesByType('navigation').some(entry => entry.type === 'reload')) {
      sessionStorage.removeItem('openTopicChatId');
        // Dispatch event when chat is closed too
        window.dispatchEvent(new Event('topicChatOpened'));
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

  const handleMediaClick = (e) => {
    // Prevent click from bubbling to document
    e.stopPropagation();
    setShowMediaMenu(!showMediaMenu);
  };

  const handleCameraClick = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      
      // Create video preview container
      const container = document.createElement('div');
      container.className = 'fixed inset-0 bg-black z-[60] flex items-center justify-center';
      
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      const context = canvas.getContext('2d');
      
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.className = 'w-full h-full object-cover';
      
      const captureButton = document.createElement('button');
      captureButton.className = 'absolute bottom-8 left-1/2 transform -translate-x-1/2';
      captureButton.innerHTML = '<div class="w-12 h-12 rounded-full border-4 border-white"></div>';
      
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

  const getPairingId = (uid1, uid2) => {
    return [uid1, uid2].sort().join('_');
  };

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !selectedFile) || uploadingMedia) return;

    try {
      const messageData = {
        text: newMessage.trim(),
        userId: user.uid,
        partnerId: partner.uid,
        userName: user.displayName || 'Anonymous',
        userPhotoURL: user.photoURL,
        userDisplayName: user.displayName || 'Anonymous',
        timestamp: serverTimestamp(),
        edited: false
      };

      if (replyingTo) {
        messageData.replyTo = {
          id: replyingTo.id,
          text: replyingTo.text,
          userId: replyingTo.userId,
          userPhotoURL: replyingTo.userPhotoURL,
          userDisplayName: replyingTo.userDisplayName,
          media: replyingTo.media
        };
      }

      let mediaData = null;
      if (selectedFile) {
        setUploadingMedia(true);
        mediaData = await uploadMedia(selectedFile);
      }

      const chatRef = ref(rtdb, `topicChats/${topic.id}`);
      const messageDataWithMedia = {
        ...messageData,
        ...(mediaData && {
          media: {
            url: mediaData.url,
            type: selectedFile.type,
            publicId: mediaData.publicId,
            resourceType: mediaData.resourceType,
            format: mediaData.format
          }
        })
      };

      const newMessageRef = await push(chatRef, messageDataWithMedia);

      if (isOnline) {
        update(ref(rtdb, `topicChats/${topic.id}/${newMessageRef.key}`), {
          delivered: true
        });
      }

      // Update message count with consistent pairing ID
      const pairingId = getPairingId(user.uid, partner.uid);
      const messageCountRef = ref(rtdb, `messageCount/${pairingId}`);
      const countSnapshot = await get(messageCountRef);
      const currentCount = countSnapshot.val() || 0;
      await set(messageCountRef, currentCount + 1);

      // Clear input and states
      setNewMessage('');
      setReplyingTo(null);
      setSelectedFile(null);
      setPreviewUrl(null);
      setUploadingMedia(false);
      localStorage.removeItem(`messageDraft_${topic.id}_${user?.uid}`);
      
      // Reset textarea height
      if (inputRef.current) {
        inputRef.current.style.height = '42px';
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please try again.');
      setUploadingMedia(false);
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

  // Update the partner data sync effect
  useEffect(() => {
    if (!partner?.uid) return;

    // Set up real-time listener for partner's profile
    const partnerRef = ref(rtdb, `users/${partner.uid}`);
    const unsubscribe = onValue(partnerRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        // Update local partner data state
        setPartnerData(current => ({
          ...current,
          ...data,
          photoURL: data.photoURL || current?.photoURL,
          displayName: data.displayName || current?.displayName
        }));
      }
    });

    return () => unsubscribe();
  }, [partner?.uid]);

  // Modify the message count effect
  useEffect(() => {
    if (!topic?.id || !user?.uid || !partner?.uid) return;

    const pairingId = getPairingId(user.uid, partner.uid);
    const messageCountRef = ref(rtdb, `messageCount/${pairingId}`);
    
    const unsubscribe = onValue(messageCountRef, (snapshot) => {
      const count = snapshot.val() || 0;
      setMessageCount(count);
      setRelationshipLevel(getRelationshipLevel(count));
      
      // Calculate progress to next level
      const currentLevelIndex = RELATIONSHIP_LEVELS.findIndex(level => 
        count >= level.minMessages && count <= level.maxMessages
      );
      
      if (currentLevelIndex < RELATIONSHIP_LEVELS.length - 1) {
        const currentLevel = RELATIONSHIP_LEVELS[currentLevelIndex];
        const nextLevel = RELATIONSHIP_LEVELS[currentLevelIndex + 1];
        const progress = ((count - currentLevel.minMessages) / 
          (nextLevel.minMessages - currentLevel.minMessages)) * 100;
        setNextLevelProgress(Math.min(progress, 100));
      } else {
        setNextLevelProgress(100);
      }
    });

    return () => unsubscribe();
  }, [topic?.id, user?.uid, partner?.uid]);

  const handleDeleteTopic = async () => {
    if (!isOnline || !user?.uid) {
      setError('You must be online to delete this topic');
      return;
    }

    try {
      // Delete the topic
      const topicRef = ref(rtdb, `topics/${topic.id}`);
      await remove(topicRef);

      // Delete associated chat messages
      const chatRef = ref(rtdb, `topicChats/${topic.id}`);
      await remove(chatRef);

      // Close the chat after deletion
      onClose();
    } catch (error) {
      console.error('Error deleting topic:', error);
      setError('Failed to delete topic. Please try again.');
    }
  };

  const handleEditTopic = async (newQuestion) => {
    if (!isOnline || !user?.uid) {
      setError('You must be online to edit this topic');
      return;
    }

    try {
      const topicRef = ref(rtdb, `topics/${topic.id}`);
      await update(topicRef, {
        question: newQuestion,
        updatedAt: serverTimestamp()
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Error editing topic:', error);
      setError('Failed to edit topic. Please try again.');
    }
  };

  const handleImageClick = (imageUrl) => {
    setViewingImage(imageUrl);
  };

  if (loading) {
    return <div className="text-center py-4">Loading messages...</div>;
  }

  return (
    <div className="fixed inset-0 bg-[#efeae2] dark:bg-[#0b141a] z-50 flex flex-col h-[var(--chat-height)] max-h-[100%]">
      {/* Enhanced Header with Profile Display and Topic */}
      <div className="flex-none bg-[#f0f2f5] dark:bg-[#202c33] border-b border-[#d1d7db] dark:border-[#2f3b44]">
        {/* Topic Banner */}
        <div className="px-4 py-2 bg-[#008069] dark:bg-[#00a884] text-white">
          <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium leading-tight">
            Topic Discussion
          </h2>
            {topic.createdBy === user?.uid && (
              <div className="flex items-center gap-1">
                  <button
                    onClick={() => setIsEditing(true)}
                  className="p-1 hover:bg-white/10 rounded-full transition-colors"
                    title="Edit Topic"
                  >
                  <PencilIcon className="h-4 w-4" />
                  </button>
              <button
                onClick={handleDeleteTopic}
                  className="p-1 hover:bg-white/10 rounded-full transition-colors text-red-200 hover:text-red-100"
                title="Delete Topic"
              >
                  <TrashIcon className="h-4 w-4" />
              </button>
              </div>
            )}
          </div>
          {isEditing ? (
            <div className="flex items-center space-x-2 mt-0.5">
              <input
                type="text"
                defaultValue={topic.question}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleEditTopic(e.target.value);
                  } else if (e.key === 'Escape') {
                    setIsEditing(false);
                  }
                }}
                onBlur={(e) => handleEditTopic(e.target.value)}
                autoFocus
                className="flex-1 bg-transparent text-[13px] text-white opacity-90 border-b border-white/30 focus:border-white focus:outline-none px-0 py-0.5"
              />
              <button
                onClick={() => setIsEditing(false)}
                className="p-1 hover:bg-white/10 rounded-full transition-colors"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          ) : (
          <p className="text-[13px] opacity-90 mt-0.5 leading-tight line-clamp-2">
            {topic.question}
          </p>
          )}
        </div>

        {/* Profile Section */}
        <div className="px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center min-w-0 flex-1 space-x-3">
              <button
                onClick={onClose}
                className="flex-none p-1 -ml-1 text-[#54656f] hover:text-[#3b4a54] dark:text-[#aebac1] dark:hover:text-[#e9edef] rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
              
              {/* Partner's profile picture - use partnerData instead of partner */}
              {partnerData && (
                <ProfilePicture 
                  size="md" 
                  userId={partnerData.uid}
                  photoURL={partnerData.photoURL}
                  displayName={partnerData.displayName}
                />
              )}
              
              <div className="min-w-0 flex-1">
                <div className="flex items-center">
                  <h3 className="text-[15px] font-medium text-[#111b21] dark:text-[#e9edef] leading-tight truncate">
                    {partnerData?.displayName || 'Partner'}
                  </h3>
                  {isOnline && (
                    <span className="inline-flex ml-2 relative">
                      <span className="w-2.5 h-2.5 bg-green-500 rounded-full"></span>
                      <span className="absolute w-2.5 h-2.5 bg-green-500 rounded-full animate-ping opacity-75"></span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[12px] leading-tight mt-0.5">
                  <span className="text-[#667781] dark:text-[#8696a0]">
                  {isOnline ? 'Online' : 'Offline'}
                  </span>
                  <span className="text-[#667781] dark:text-[#8696a0]">•</span>
                  <span className={`${relationshipLevel.color} font-medium`}>
                    {relationshipLevel.level}
                  </span>
                  <span className="text-[#667781] dark:text-[#8696a0]">
                    ({messageCount} messages)
                  </span>
                </div>
              </div>
            </div>
            
            {/* Chat Options */}
            <button className="p-2 text-[#54656f] hover:text-[#3b4a54] dark:text-[#aebac1] dark:hover:text-[#e9edef] rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
              <EllipsisVerticalIcon className="h-5 w-5" />
            </button>
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
              onImageClick={handleImageClick}
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

