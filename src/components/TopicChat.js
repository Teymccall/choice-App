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
import { formatTime } from '../utils/dateUtils';
import { toast } from 'react-hot-toast';

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
  const [isDragging, setIsDragging] = useState(false);
  const topicInputRef = useRef(null);

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
    if (!topic?.id || !user?.uid) return;

    const chatRef = ref(rtdb, `topicChats/${topic.id}`);
    const deletedMessagesRef = ref(rtdb, `deletedMessages/${user.uid}/${topic.id}`);
    
    const unsubscribe = onValue(chatRef, async (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setMessages([]);
        setLoading(false);
        return;
      }

      try {
        // Get deleted messages for current user
        const deletedSnapshot = await get(deletedMessagesRef);
        const deletedMessages = deletedSnapshot.val() || {};

        // Update messages list with null checks for partner
        const messagesList = Object.entries(data)
          .map(([id, message]) => ({
            id,
            ...message,
            timestamp: message.timestamp || Date.now(),
            isDeleted: !!deletedMessages[id],
            sent: true,
            delivered: message.delivered || false,
            read: message.read || false
          }))
          .filter(message => 
            // Only show messages that belong to the current user or their partner
            message.userId === user.uid || (partner && message.userId === partner.uid)
          )
          .sort((a, b) => {
            const timestampA = typeof a.timestamp === 'number' ? a.timestamp : a.timestamp?.toMillis?.() || 0;
            const timestampB = typeof b.timestamp === 'number' ? b.timestamp : b.timestamp?.toMillis?.() || 0;
            return timestampA - timestampB;
          });

        setMessages(messagesList);
        setLoading(false);
        setTimeout(scrollToBottom, 100);

        // Only mark messages as read if partner exists
        if (partner?.uid) {
          const unreadMessages = messagesList
            .filter(msg => msg.userId === partner.uid && !msg.read)
            .map(msg => msg.id);

          if (unreadMessages.length > 0) {
            const updates = {};
            unreadMessages.forEach(messageId => {
              updates[`${messageId}/read`] = true;
              updates[`${messageId}/readAt`] = serverTimestamp();
            });
            await update(chatRef, updates);
          }
        }
      } catch (error) {
        console.error('Error processing messages:', error);
        toast.error('Error loading messages. Please try again.');
      }
    });

    return () => unsubscribe();
  }, [topic?.id, user?.uid, partner?.uid]);

  // Add effect to mark messages as delivered when online
  useEffect(() => {
    if (!isOnline || !topic?.id || !partner?.uid || !user?.uid) return;

    const chatRef = ref(rtdb, `topicChats/${topic.id}`);
    const query = ref(rtdb, `topicChats/${topic.id}`);
    
    const unsubscribe = onValue(query, async (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      // Find undelivered messages from partner
      const undeliveredMessages = Object.entries(data)
        .filter(([_, msg]) => msg.userId === partner.uid && !msg.delivered)
        .map(([id]) => id);

      if (undeliveredMessages.length > 0) {
        const updates = {};
        undeliveredMessages.forEach(messageId => {
          updates[`${messageId}/delivered`] = true;
          updates[`${messageId}/deliveredAt`] = serverTimestamp();
        });
        await update(chatRef, updates);
      }
    });

    return () => unsubscribe();
  }, [isOnline, topic?.id, partner?.uid, user?.uid]);

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

    // Only update typing status if there's actual content
    if (message.trim()) {
      console.log('Message changed, setting typing status to true');
      updateTypingStatus(true);

      typingTimeoutRef.current = setTimeout(() => {
        console.log('Typing timeout, setting typing status to false');
        updateTypingStatus(false);
      }, 3000); // Increased to 3 seconds for better UX
    } else {
      // If message is empty, clear typing status immediately
      updateTypingStatus(false);
    }
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
      // Adjust height if needed
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  };

  const getPairingId = (uid1, uid2) => {
    return [uid1, uid2].sort().join('_');
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    const trimmedMessage = newMessage.trim();
    
    if (editingMessage) {
      // Handle editing
      if (trimmedMessage !== editingMessage.text) {
        await handleEditMessage(editingMessage.id, trimmedMessage);
      }
      cancelEditing();
    } else {
      // Handle new message
      if ((!trimmedMessage && !selectedFile) || uploadingMedia) return;

      try {
        // Clear input and states immediately for better UX
        const messageToSend = trimmedMessage;
        setNewMessage('');
        const replyingToRef = replyingTo;
        setReplyingTo(null);
        localStorage.removeItem(`messageDraft_${topic.id}_${user?.uid}`);
        
        // Reset textarea height
        if (inputRef.current) {
          inputRef.current.style.height = '42px';
        }

        const messageData = {
          text: messageToSend || '', // Ensure text is never undefined
          userId: user.uid,
          partnerId: partner.uid,
          userName: user.displayName || 'Anonymous',
          userPhotoURL: user.photoURL,
          userDisplayName: user.displayName || 'Anonymous',
          timestamp: serverTimestamp(),
          sent: true,
          delivered: false,
          read: false,
          edited: false
        };

        if (replyingToRef) {
          // Only include necessary properties in replyTo
          messageData.replyTo = {
            id: replyingToRef.id,
            text: replyingToRef.text || '',
            userId: replyingToRef.userId,
            userDisplayName: replyingToRef.userDisplayName
          };
          
          // Only add media if it exists
          if (replyingToRef.media) {
            messageData.replyTo.media = {
              type: replyingToRef.media.type,
              url: replyingToRef.media.url
            };
          }
        }

        let mediaData = null;
        if (selectedFile) {
          setUploadingMedia(true);
          mediaData = await uploadMedia(selectedFile);
          setSelectedFile(null);
          setPreviewUrl(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
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
            delivered: true,
            deliveredAt: serverTimestamp()
          });
        }

        // Update message count with consistent pairing ID
        const pairingId = getPairingId(user.uid, partner.uid);
        const messageCountRef = ref(rtdb, `messageCount/${pairingId}`);
        const countSnapshot = await get(messageCountRef);
        const currentCount = countSnapshot.val() || 0;
        await set(messageCountRef, currentCount + 1);

        setUploadingMedia(false);
        
      } catch (error) {
        console.error('Error sending message:', error);
        toast.error('Failed to send message. Please try again.');
        setUploadingMedia(false);
      }
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
      const loadingToast = toast.loading('Deleting message...');
      
      const chatRef = ref(rtdb, `topicChats/${topic.id}/${messageId}`);
      const messageSnapshot = await get(chatRef);
      
      if (!messageSnapshot.exists()) {
        toast.dismiss(loadingToast);
        toast.error('Message not found');
        return;
      }

      const messageData = messageSnapshot.val();
      
      if (deleteForEveryone && messageData.userId !== user.uid) {
        toast.dismiss(loadingToast);
        toast.error('You can only delete your own messages for everyone');
        return;
      }
      
      if (deleteForEveryone) {
        await update(chatRef, {
          deletedForEveryone: true,
          deletedBy: user.uid,
          deletedAt: serverTimestamp()
        });
        
        setMessages(prevMessages => 
          prevMessages.map(msg => 
            msg.id === messageId 
              ? { ...msg, deletedForEveryone: true, deletedBy: user.uid } 
              : msg
          )
        );
        
        toast.dismiss(loadingToast);
        toast.success('Message deleted for everyone');
      } else {
        const userDeletedRef = ref(rtdb, `deletedMessages/${user.uid}/${topic.id}/${messageId}`);
        await set(userDeletedRef, serverTimestamp());
        
        setMessages(prevMessages => 
          prevMessages.map(msg => 
            msg.id === messageId 
              ? { ...msg, isDeleted: true } 
              : msg
          )
        );
        
        toast.dismiss(loadingToast);
        toast.success('Message deleted for you');
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Failed to delete message. Please try again.');
    }
  };

  const handleEditMessage = async (messageId, newText) => {
    try {
      const loadingToast = toast.loading('Saving changes...');
      
      const messageRef = ref(rtdb, `topicChats/${topic.id}/${messageId}`);
      await update(messageRef, {
        text: newText,
        edited: true,
        editedAt: serverTimestamp()
      });
      
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === messageId 
            ? { ...msg, text: newText, edited: true } 
            : msg
        )
      );
      
      toast.dismiss(loadingToast);
      toast.success('Message updated successfully');
    } catch (error) {
      console.error('Error editing message:', error);
      toast.error('Failed to edit message. Please try again.');
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
          toast.error('Failed to send voice message. Please try again.');
          setTimeout(() => toast.dismiss(), 3000);
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
      toast.error('Could not access microphone. Please check your permissions.');
      setTimeout(() => toast.dismiss(), 3000);
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

  // Add this useEffect for mobile viewport handling
  useEffect(() => {
    const setVH = () => {
      // First we get the viewport height and we multiple it by 1% to get a value for a vh unit
      const vh = window.innerHeight * 0.01;
      // Then we set the value in the --vh custom property to the root of the document
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    // Initial set
    setVH();

    // Add event listeners
    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', setVH);

    // Cleanup
    return () => {
      window.removeEventListener('resize', setVH);
      window.removeEventListener('orientationchange', setVH);
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
    if (!topic?.id) return;
    
    const chatRef = ref(rtdb, `topicChats/${topic.id}`);
    const unsubscribe = onValue(chatRef, (snapshot) => {
      const data = snapshot.val();
      const count = data ? Object.keys(data).length : 0;
      setMessageCount(count);
    });

    return () => unsubscribe();
  }, [topic?.id]);

  // Add this effect to listen for topic deletion
  useEffect(() => {
    if (!topic?.id) return;

    // Listen for topic deletion
    const topicRef = ref(rtdb, `topics/${topic.id}`);
    const unsubscribe = onValue(topicRef, (snapshot) => {
      if (!snapshot.exists() && !loading) {
        // Topic was deleted, close the chat
        onClose();
        // Optionally show a message
        setError('This topic has been deleted');
      }
    });

    return () => unsubscribe();
  }, [topic?.id, loading, onClose]);

  const handleDeleteTopic = async () => {
    if (!isOnline || !user?.uid) {
      toast.error('You must be online to delete this topic');
      return;
    }

    try {
      // Show loading toast
      const loadingToast = toast.loading('Deleting topic...');

      // Delete the topic first
      const topicRef = ref(rtdb, `topics/${topic.id}`);
      await remove(topicRef);

      // Then delete associated chat messages
      const chatRef = ref(rtdb, `topicChats/${topic.id}`);
      await remove(chatRef);

      // Delete any associated deleted messages records
      const deletedMessagesRef = ref(rtdb, `deletedMessages/${user.uid}/${topic.id}`);
      await remove(deletedMessagesRef);
      
      const partnerDeletedMessagesRef = ref(rtdb, `deletedMessages/${partner.uid}/${topic.id}`);
      await remove(partnerDeletedMessagesRef);

      // Delete any typing indicators
      const typingRef = ref(rtdb, `typing/${topic.id}`);
      await remove(typingRef);

      // Dismiss loading toast and show success
      toast.dismiss(loadingToast);
      toast.success('Topic deleted successfully');

      // Close the chat after deletion
      onClose();
    } catch (error) {
      console.error('Error deleting topic:', error);
      toast.error('Failed to delete topic. Please try again.');
    }
  };

  const handleEditTopic = async (newQuestion) => {
    if (!isOnline || !user?.uid) {
      toast.error('You must be online to edit this topic');
      return;
    }

    if (!newQuestion?.trim()) {
      toast.error('Topic question cannot be empty');
      return;
    }

    try {
      const loadingToast = toast.loading('Saving changes...');
      
      const topicRef = ref(rtdb, `topics/${topic.id}`);
      await update(topicRef, {
        question: newQuestion.trim(),
        updatedAt: serverTimestamp()
      });
      
      toast.dismiss(loadingToast);
      toast.success('Topic updated successfully');
      setIsEditing(false);
    } catch (error) {
      console.error('Error editing topic:', error);
      toast.error('Failed to edit topic. Please try again.');
    }
  };

  // Add a new function to handle the save button click
  const handleSaveEdit = () => {
    const newQuestion = topicInputRef.current?.value;
    if (newQuestion) {
      handleEditTopic(newQuestion);
    } else {
      toast.error('Topic question cannot be empty');
    }
  };

  // Add a disconnection notice component
  const DisconnectionNotice = () => (
    <div className="absolute top-0 left-0 right-0 bg-yellow-500 text-white px-4 py-2 text-center">
      Partner disconnected. Some features may be limited.
    </div>
  );

  if (loading) {
    return <div className="text-center py-4">Loading messages...</div>;
  }

  return (
    <div 
      className="fixed inset-0 bg-[#efeae2] dark:bg-[#0b141a] z-50 flex flex-col" 
      style={{ height: 'calc(var(--vh, 1vh) * 100)' }}
    >
      {!partner && <DisconnectionNotice />}
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
                ref={topicInputRef}
                type="text"
                defaultValue={topic.question}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveEdit();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setIsEditing(false);
                  }
                }}
                className="flex-1 bg-transparent text-[13px] text-white opacity-90 border-b border-white/30 focus:border-white focus:outline-none px-0 py-0.5"
                autoFocus
                placeholder="Enter topic question..."
              />
              <button
                onClick={handleSaveEdit}
                className="p-1 hover:bg-white/10 rounded-full transition-colors"
                title="Save"
              >
                <CheckIcon className="h-4 w-4 text-white" />
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="p-1 hover:bg-white/10 rounded-full transition-colors"
                title="Cancel"
              >
                <XMarkIcon className="h-4 w-4 text-white" />
              </button>
            </div>
          ) : (
            <p className="text-[13px] opacity-90 mt-0.5 leading-tight line-clamp-2">
              {topic.question} ({messageCount} messages)
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
      <div 
        className="messages-container flex-1 overflow-y-auto min-h-0 px-[3%] py-2 space-y-1 transition-all duration-200"
        style={{ 
          height: '100%',
          maxHeight: 'calc(100% - 120px)', // Account for header and input area
          willChange: 'backdrop-filter'
        }}
      >
          {messages.map((message) => (
            <Message
              key={message.id}
              message={message}
              isOwnMessage={message.userId === user.uid}
              user={user}
            onReply={(msg) => {
              handleReply(msg);
              // Scroll to bottom with a slight delay to ensure the UI has updated
              setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              }, 100);
            }}
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

      {/* Input area with Media Preview */}
      <div 
        className="flex-none bg-[#f0f2f5] dark:bg-[#202c33] relative"
        style={{ 
          paddingBottom: 'env(safe-area-inset-bottom, 0px)'
        }}
      >
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
        
        {/* Media Preview - Moved to top */}
        {selectedFile && (
          <div className="px-3 py-2 bg-white dark:bg-[#2a3942] border-b border-[#e9edef] dark:border-[#3b4a54]">
            <div className="flex items-center">
              {selectedFile.type.startsWith('image/') ? (
                <div className="w-12 h-12 rounded-md overflow-hidden bg-black/5 dark:bg-white/5 flex-shrink-0">
                  <img
                    src={previewUrl}
                    alt="Selected media"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-md bg-black/5 dark:bg-white/5 flex items-center justify-center flex-shrink-0">
                  <DocumentIcon className="h-6 w-6 text-[#54656f] dark:text-[#aebac1]" />
                </div>
              )}
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-[15px] text-[#111b21] dark:text-[#e9edef] truncate">
                  {selectedFile.name}
                </p>
                <p className="text-[13px] text-[#667781] dark:text-[#8696a0]">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
                className="ml-3 p-1 text-[#54656f] hover:text-[#3b4a54] dark:text-[#aebac1] dark:hover:text-[#e9edef] rounded-full hover:bg-black/5 dark:hover:bg-white/5"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
          </div>
        )}

        {replyingTo && !editingMessage && (
          <div className="flex items-center justify-between bg-[#fff] dark:bg-[#2a3942] px-3 py-2 border-b border-[#e9edef] dark:border-[#3b4a54]">
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

        <div className="flex items-end space-x-2 px-2 py-2">
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
                if (e.key === 'Escape') {
                  if (editingMessage) {
                    cancelEditing();
                  } else if (replyingTo) {
                    setReplyingTo(null);
                  }
                }
              }}
              placeholder={editingMessage ? "Edit message..." : "Type a message"}
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

      {/* Update styles for mobile */}
      <style jsx global>{`
        /* Prevent body scroll when chat is open */
        body.chat-open {
            overflow: hidden;
          position: fixed;
          width: 100%;
          height: 100%;
        }

        /* Prevent elastic scroll on iOS */
        .overflow-y-auto {
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-y: contain;
        }

        /* Prevent zoom on input focus for iOS */
        @media screen and (max-width: 768px) {
          input, textarea {
            font-size: 16px !important;
          }
        }

        /* Handle viewport height on mobile */
        @supports (-webkit-touch-callout: none) {
          .fixed.inset-0 {
            height: -webkit-fill-available;
          }
        }

        /* Ensure content is visible above keyboard on iOS */
        @media screen and (max-width: 768px) {
          .fixed.inset-0 {
            position: fixed;
            top: 0;
            right: 0;
            bottom: 0;
            left: 0;
            height: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default TopicChat; 

