import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  PlusIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
  TagIcon,
  UserIcon,
  HeartIcon,
  HomeIcon,
  RocketLaunchIcon,
  ChatBubbleLeftRightIcon,
  XMarkIcon,
  HashtagIcon,
  CheckCircleIcon,
  PencilIcon,
} from '@heroicons/react/24/outline';
import { ref, onValue, push, update, serverTimestamp, get, set } from 'firebase/database';
import { rtdb } from '../firebase/config';
import TopicChat from '../components/TopicChat';

const CATEGORY_ICONS = {
  'All': HashtagIcon,
  'Relationship': HeartIcon,
  'Household': HomeIcon,
  'Future': RocketLaunchIcon,
  'Communication': ChatBubbleLeftRightIcon,
  'Custom': UserIcon,
};

const formatDate = (timestamp) => {
  if (!timestamp) return '';
  // Handle both Realtime DB timestamps (numbers) and Firestore timestamps (objects)
  const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp.toDate?.() || new Date(timestamp);
  return date.toLocaleDateString();
};

const TopicCard = ({ topic, onRespond, onDiscuss, onEdit, onDelete, unreadMessages, onReady }) => {
  const { user, partner } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editedQuestion, setEditedQuestion] = useState(topic.question);
  const userResponse = topic.responses?.[user.uid]?.response;
  const partnerResponse = topic.responses?.[partner?.uid]?.response;
  const userReady = topic.readyState?.[user.uid];
  const partnerReady = topic.readyState?.[partner?.uid];
  const bothReady = userReady && partnerReady;
  const formattedDate = formatDate(topic.createdAt);
  const partnerName = partner?.displayName || 'Your partner';
  const bothResponded = userResponse !== undefined && partnerResponse !== undefined;
  const canEdit = topic.createdBy === user.uid && !bothResponded;

  const handleEdit = async () => {
    if (editedQuestion.trim() === topic.question || !editedQuestion.trim()) {
      setIsEditing(false);
      setEditedQuestion(topic.question);
      return;
    }

    await onEdit(topic.id, editedQuestion.trim());
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleEdit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditedQuestion(topic.question);
    }
  };

  // Get response status message
  const getStatusMessage = () => {
    if (!userReady && !partnerReady) {
      return (
        <div className="flex items-center text-sm text-blue-600 dark:text-blue-400">
          <div className="w-2 h-2 bg-blue-500 rounded-full mr-2" />
          Click ready when you want to make your choice!
        </div>
      );
    }
    if (!userReady && partnerReady) {
      return (
        <div className="flex items-center text-sm text-blue-600 dark:text-blue-400">
          <div className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse" />
          {partnerName} is ready - click ready when you are!
        </div>
      );
    }
    if (userReady && !partnerReady) {
      return (
        <div className="flex items-center text-sm text-green-600 dark:text-green-400">
          <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
          Waiting for {partnerName} to be ready...
        </div>
      );
    }
    if (bothReady && !userResponse) {
      return (
        <div className="flex items-center text-sm text-green-600 dark:text-green-400">
          <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
          Both ready - make your choice!
        </div>
      );
    }
    if (userResponse && !partnerResponse) {
      return (
        <div className="flex items-center text-sm text-blue-600 dark:text-blue-400">
          <div className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse" />
          Waiting for {partnerName}'s decision...
        </div>
      );
    }
    if (bothResponded) {
      return (
        <div className="flex items-center text-sm text-green-600 dark:text-green-400">
          <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
          Both decisions made!
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-black rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden transition-all duration-200 hover:shadow-md">
      {/* Header */}
      <div className="p-4">
        <div className="flex flex-col space-y-2">
          <div className="flex items-start justify-between">
            {isEditing ? (
              <div className="flex-1 flex items-center space-x-2">
                <input
                  type="text"
                  value={editedQuestion}
                  onChange={(e) => setEditedQuestion(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleEdit}
                  autoFocus
                  className="flex-1 px-2 py-1 text-lg font-medium bg-transparent border-b-2 border-black dark:border-white focus:outline-none focus:border-primary-500 dark:text-white"
                  placeholder="Enter topic question..."
                />
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditedQuestion(topic.question);
                  }}
                  className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <div className="flex-1 flex items-start justify-between">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white flex-1">
                  {topic.question}
                </h3>
                {canEdit && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="ml-2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                    title="Edit topic"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
              <span>{formattedDate}</span>
              <span>•</span>
              <span className="flex items-center">
                {CATEGORY_ICONS[topic.category || 'Custom'] && (
                  <span className="mr-1">
                    {React.createElement(CATEGORY_ICONS[topic.category || 'Custom'], {
                      className: "h-4 w-4"
                    })}
                  </span>
                )}
                {topic.category || 'Custom'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Response Status */}
      <div className="px-4 pb-4">
        {getStatusMessage()}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center space-x-2">
            {!userResponse && (
              <>
                {!bothReady && (
                  <button
                    onClick={() => onReady(topic.id, !userReady)}
                    className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200 
                      ${userReady 
                        ? 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800'
                      }`}
                  >
                    <CheckCircleIcon className="h-4 w-4 mr-1.5" />
                    {userReady ? 'Ready!' : 'Ready?'}
                  </button>
                )}
                {bothReady && (
                  <>
                    <button
                      onClick={() => onRespond(topic.id, true)}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-200 dark:hover:bg-green-800 transition-colors duration-200"
                    >
                      <HandThumbUpIcon className="h-4 w-4 mr-1.5" />
                      Yes
                    </button>
                    <button
                      onClick={() => onRespond(topic.id, false)}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-800 transition-colors duration-200"
                    >
                      <HandThumbDownIcon className="h-4 w-4 mr-1.5" />
                      No
                    </button>
                  </>
                )}
              </>
            )}
          </div>

          {/* Discuss Button */}
          <button
            onClick={() => onDiscuss(topic)}
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-black hover:bg-gray-900 dark:bg-white dark:text-black dark:hover:bg-gray-200 transition-colors relative"
          >
            <ChatBubbleLeftRightIcon className="h-4 w-4 mr-1.5" />
            Discuss
            {unreadMessages && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-600 dark:bg-blue-400 rounded-full animate-pulse" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const Topics = () => {
  const { user, partner, isOnline } = useAuth();
  const [newTopic, setNewTopic] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [unreadResponses, setUnreadResponses] = useState({});
  const [unreadMessagesByTopic, setUnreadMessagesByTopic] = useState({});

  // Check for open chat on mount
  useEffect(() => {
    const openTopicChatId = sessionStorage.getItem('openTopicChatId');
    if (openTopicChatId && user?.uid && partner?.uid) {
      // Fetch the topic data and open the chat
      const topicRef = ref(rtdb, `topics/${openTopicChatId}`);
      get(topicRef).then((snapshot) => {
        if (snapshot.exists()) {
          const topicData = snapshot.val();
          // Only set the topic if it belongs to the current user pair
          if (topicData.participants?.includes(user.uid) && 
              topicData.participants?.includes(partner.uid)) {
            setSelectedTopic({
              id: openTopicChatId,
              ...topicData
            });
          }
        }
      });
    }
  }, [user?.uid, partner?.uid]);

  // Remove the duplicate effect that was clearing the session storage
  useEffect(() => {
    const handleOpenChat = (event) => {
      const { topicId } = event.detail;
      const topic = topics.find(t => t.id === topicId);
      if (topic) {
        setSelectedTopic(topic);
      }
    };

    window.addEventListener('openTopicChat', handleOpenChat);
    return () => window.removeEventListener('openTopicChat', handleOpenChat);
  }, [topics]);

  // Load topics
  useEffect(() => {
    if (!user?.uid || !partner?.uid || !isOnline) {
      setTopics([]);
      setLoading(false);
      return;
    }

    const topicsRef = ref(rtdb, 'topics');
    
    const unsubscribe = onValue(topicsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setTopics([]);
        setLoading(false);
        return;
      }

      // Filter topics to only include those between current partners
      const relevantTopics = Object.entries(data)
        .filter(([_, topic]) => {
          // Check both createdBy/partnerId and vice versa to catch all relevant topics
          const isRelevantTopic = 
            (topic.createdBy === user.uid && topic.partnerId === partner.uid) ||
            (topic.createdBy === partner.uid && topic.partnerId === user.uid);
          
          return isRelevantTopic;
        })
        .map(([id, topic]) => {
          // Process responses and update seen status
          const responses = topic.responses || {};
          
          // If there's a response from partner that current user hasn't seen
          if (responses[partner.uid] && !responses[partner.uid].seen?.[user.uid]) {
            // Mark it as seen
            const topicRef = ref(rtdb, `topics/${id}/responses/${partner.uid}/seen/${user.uid}`);
            set(topicRef, true).catch(console.error);
          }

          return {
            id,
            ...topic,
            responses,
            status: topic.status || 'active',
            // Add computed properties for UI
            bothResponded: responses[user.uid]?.response !== undefined && 
                         responses[partner.uid]?.response !== undefined,
            match: topic.match || false
          };
        })
        .sort((a, b) => {
          // Sort completed topics to the bottom
          if (a.status === 'completed' && b.status !== 'completed') return 1;
          if (a.status !== 'completed' && b.status === 'completed') return -1;
          
          // Then sort by timestamp
          const timeA = typeof a.createdAt === 'number' ? a.createdAt : a.createdAt?.toMillis?.() || 0;
          const timeB = typeof b.createdAt === 'number' ? b.createdAt : b.createdAt?.toMillis?.() || 0;
          return timeB - timeA;
        });

      setTopics(relevantTopics);
      setLoading(false);
    }, (error) => {
      console.error('Error loading topics:', error);
      setError(error.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid, partner?.uid, isOnline]);

  useEffect(() => {
    if (!user?.uid || !topics.length) return;

    // Create refs for all topics to monitor their chats
    const unsubscribes = topics.map(topic => {
      const chatRef = ref(rtdb, `topicChats/${topic.id}`);
      return onValue(chatRef, (snapshot) => {
        const messages = snapshot.val();
        
        // Skip if no messages
        if (!messages) return;

        // Get last read timestamp for this topic
        const lastReadTimestamp = parseInt(localStorage.getItem(`lastRead_${topic.id}_${user.uid}`)) || 0;
        
        // Check if topic is currently open
        const isTopicOpen = selectedTopic?.id === topic.id;
        
        // If topic is open, mark as read
        if (isTopicOpen) {
          localStorage.setItem(`lastRead_${topic.id}_${user.uid}`, Date.now().toString());
          setUnreadMessagesByTopic(prev => ({
            ...prev,
            [topic.id]: false
          }));
          return;
        }

        // Check for unread messages from partner
        const hasUnread = Object.values(messages).some(message => 
          message.userId !== user.uid && 
          message.timestamp > lastReadTimestamp
        );

        // Update unread state for this topic
        setUnreadMessagesByTopic(prev => ({
          ...prev,
          [topic.id]: hasUnread
        }));
      });
    });

    // Cleanup listeners
    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [user?.uid, topics, selectedTopic?.id]);

  // Add effect to track unread responses
  useEffect(() => {
    if (!user?.uid || !partner?.uid) return;

    const topicsRef = ref(rtdb, 'topics');
    
    const unsubscribe = onValue(topicsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setUnreadResponses({});
        return;
      }

      const newUnreadResponses = {};
      Object.entries(data).forEach(([topicId, topic]) => {
        if (!topic.responses || !topic.responses[partner.uid]) return;
        
        const partnerResponse = topic.responses[partner.uid];
        const lastChecked = parseInt(localStorage.getItem(`lastChecked_${topicId}_${user.uid}`)) || 0;
        
        if (parseInt(partnerResponse.timestamp) > lastChecked) {
          newUnreadResponses[topicId] = true;
        }
      });

      setUnreadResponses(newUnreadResponses);
    });

    return () => unsubscribe();
  }, [user?.uid, partner?.uid]);

  // Add this effect to clear badges when viewing topics
  useEffect(() => {
    if (!user?.uid) return;
    
    // Clear new topics badge
    localStorage.setItem(`lastChecked_topics_${user.uid}`, Date.now().toString());
    
    // Clear response badges for all visible topics
    topics.forEach(topic => {
      if (topic.responses?.[partner?.uid]) {
        localStorage.setItem(`lastChecked_${topic.id}_${user.uid}`, Date.now().toString());
      }
    });
  }, [topics, user?.uid, partner?.uid]);

  const handleAddTopic = async (e) => {
    e.preventDefault();
    setFormError(null);
    
    // Validation checks with user feedback
    if (!newTopic.trim()) {
      setFormError('Please enter a topic');
      return;
    }
    
    if (!isOnline) {
      setFormError('You must be online to add topics');
      return;
    }
    
    if (!partner) {
      setFormError('You need to connect with a partner first');
      return;
    }

    try {
      const topicsRef = ref(rtdb, 'topics');
      const newTopicRef = push(topicsRef);
      
      const topicData = {
        question: newTopic.trim(),
        category: selectedCategory === 'All' ? 'Custom' : selectedCategory,
        createdBy: user.uid,
        creatorName: user.displayName || 'Anonymous',
        partnerId: partner.uid,
        partnerName: partner.displayName || 'Partner',
        createdAt: serverTimestamp(),
        status: 'active',
        responses: {}
      };

      console.log('Adding new topic:', topicData);
      
      await set(newTopicRef, topicData);
      console.log('Topic added successfully');

      setNewTopic('');
      setFormError(null);
    } catch (err) {
      console.error('Error adding topic:', err);
      setFormError(err.message || 'Failed to add topic. Please try again.');
    }
  };

  const handleResponse = async (topicId, response) => {
    if (!isOnline) {
      setError('You must be online to respond to topics');
      return;
    }

    if (!user?.uid || !partner?.uid) {
      setError('You must be connected with a partner to respond to topics');
      return;
    }

    try {
      setError(null);
      
      // Get the current topic data
      const topicRef = ref(rtdb, `topics/${topicId}`);
      const snapshot = await get(topicRef);
      
      if (!snapshot.exists()) {
        setError('Topic not found');
        return;
      }

      const topicData = snapshot.val();
      
      // Validate topic belongs to current user pair
      const isValidTopic = (topicData.createdBy === user.uid && topicData.partnerId === partner.uid) ||
                          (topicData.createdBy === partner.uid && topicData.partnerId === user.uid);
      
      if (!isValidTopic) {
        setError('You are not authorized to respond to this topic');
        return;
      }

      // Check if user has already responded
      if (topicData.responses?.[user.uid]?.response !== undefined) {
        setError('You have already responded to this topic');
        return;
      }

      // Check if both users are ready
      if (!topicData.readyState?.[user.uid] || !topicData.readyState?.[partner.uid]) {
        setError('Both users must be ready before making a decision');
        return;
      }

      // Update the response
      const responseUpdate = {
        [`responses/${user.uid}`]: {
          response: response,
          timestamp: serverTimestamp(),
          userName: user.displayName || 'Anonymous'
        }
      };

      // If both users have responded, update topic status and reset ready states
      if (topicData.responses?.[partner.uid]?.response !== undefined) {
        responseUpdate.status = 'completed';
        responseUpdate.completedAt = serverTimestamp();
        responseUpdate[`readyState/${user.uid}`] = false;
        responseUpdate[`readyState/${partner.uid}`] = false;
      }

      await update(topicRef, responseUpdate);

      // Send notification to partner
      if (partner?.uid) {
        const notificationRef = ref(rtdb, `notifications/${partner.uid}`);
        const notificationData = {
          type: 'topic_response',
          title: 'New Decision',
          body: `${user.displayName || 'Your partner'} has made their decision for "${topicData.question}"`,
          topicId: topicId,
          timestamp: serverTimestamp()
        };
        
        await update(notificationRef, {
          [Date.now()]: notificationData
        });
      }

    } catch (err) {
      console.error('Error updating response:', err);
      setError('Failed to update response. Please try again.');
    }
  };

  const handleTopicView = (topic) => {
    // Clear unread states immediately before opening chat
    setUnreadMessagesByTopic(prev => ({
      ...prev,
      [topic.id]: false
    }));
    setUnreadResponses(prev => ({
      ...prev,
      [topic.id]: false
    }));
    
    // Store the open topic ID
    sessionStorage.setItem('openTopicChatId', topic.id);
    
    // Update timestamps
    localStorage.setItem(`lastRead_${topic.id}_${user.uid}`, Date.now().toString());
    localStorage.setItem(`lastChecked_${topic.id}_${user.uid}`, Date.now().toString());
    localStorage.setItem(`lastChecked_topics_${user.uid}`, Date.now().toString());
    
    // Open the topic chat
    setSelectedTopic(topic);
  };

  const handleCloseChat = () => {
    // Clear the stored topic ID
    sessionStorage.removeItem('openTopicChatId');
    setSelectedTopic(null);
  };

  const handleEditTopic = async (topicId, newQuestion) => {
    if (!isOnline) {
      setError('You must be online to edit topics');
      return;
    }

    try {
      const topicRef = ref(rtdb, `topics/${topicId}`);
      const snapshot = await get(topicRef);
      
      if (!snapshot.exists()) {
        setError('Topic not found');
        return;
      }

      const topicData = snapshot.val();
      
      // Verify user is the creator
      if (topicData.createdBy !== user.uid) {
        setError('You can only edit topics you created');
        return;
      }

      // Check if anyone has responded
      if (topicData.responses && Object.keys(topicData.responses).length > 0) {
        setError('Cannot edit topic after responses have been made');
        return;
      }

      await update(topicRef, {
        question: newQuestion,
        updatedAt: serverTimestamp()
      });

      // Send notification to partner
      if (partner?.uid) {
        const notificationRef = ref(rtdb, `notifications/${partner.uid}`);
        const notificationData = {
          type: 'topic_edited',
          title: 'Topic Edited',
          body: `${user.displayName || 'Your partner'} has edited a topic`,
          topicId: topicId,
          timestamp: serverTimestamp()
        };
        
        await update(notificationRef, {
          [Date.now()]: notificationData
        });
      }

    } catch (err) {
      console.error('Error editing topic:', err);
      setError('Failed to edit topic. Please try again.');
    }
  };

  const handleDeleteTopic = async (topicId) => {
    if (!isOnline) {
      setError('You must be online to delete topics');
      return;
    }

    try {
      setError(null);
      
      // Get the current topic data
      const topicRef = ref(rtdb, `topics/${topicId}`);
      const snapshot = await get(topicRef);
      
      if (!snapshot.exists()) {
        setError('Topic not found');
        return;
      }

      const topicData = snapshot.val();
      
      // Verify user is the creator
      if (topicData.createdBy !== user.uid) {
        setError('You can only delete topics you created');
        return;
      }

      // Delete the topic
      await set(topicRef, null);

      // Delete associated chat messages
      const chatRef = ref(rtdb, `topicChats/${topicId}`);
      await set(chatRef, null);

      // Send notification to partner
      if (partner?.uid) {
        const notificationRef = ref(rtdb, `notifications/${partner.uid}`);
        const notificationData = {
          type: 'topic_deleted',
          title: 'Topic Deleted',
          body: `${user.displayName || 'Your partner'} has deleted the topic "${topicData.question}"`,
          timestamp: serverTimestamp()
        };
        
        await update(notificationRef, {
          [Date.now()]: notificationData
        });
      }

    } catch (err) {
      console.error('Error deleting topic:', err);
      setError('Failed to delete topic. Please try again.');
    }
  };

  // eslint-disable-next-line no-unused-vars
  const categories = ['All', 'Relationship', 'Household', 'Future', 'Communication', 'Custom'];

  const filteredTopics = !topics ? [] : (
    selectedCategory === 'All'
    ? topics
    : topics.filter(topic => topic?.category === selectedCategory)
  );

  const handleReadyState = async (topicId, isReady) => {
    if (!isOnline) {
      setError('You must be online to update ready state');
      return;
    }

    if (!user?.uid || !partner?.uid) {
      setError('You must be connected with a partner to update ready state');
      return;
    }

    try {
      setError(null);
      
      // Get the current topic data
      const topicRef = ref(rtdb, `topics/${topicId}`);
      const snapshot = await get(topicRef);
      
      if (!snapshot.exists()) {
        setError('Topic not found');
        return;
      }

      const topicData = snapshot.val();
      
      // Validate topic belongs to current user pair
      const isValidTopic = (topicData.createdBy === user.uid && topicData.partnerId === partner.uid) ||
                          (topicData.createdBy === partner.uid && topicData.partnerId === user.uid);
      
      if (!isValidTopic) {
        setError('You are not authorized to update this topic');
        return;
      }

      // Update ready state
      await update(topicRef, {
        [`readyState/${user.uid}`]: isReady
      });

      // Send notification to partner
      if (partner?.uid) {
        const notificationRef = ref(rtdb, `notifications/${partner.uid}`);
        const notificationData = {
          type: 'ready_state',
          title: 'Partner Ready State Updated',
          body: `${user.displayName || 'Your partner'} is ${isReady ? 'ready' : 'not ready'} to decide on "${topicData.question}"`,
          topicId: topicId,
          timestamp: serverTimestamp()
        };
        
        await update(notificationRef, {
          [Date.now()]: notificationData
        });
      }

    } catch (err) {
      console.error('Error updating ready state:', err);
      setError('Failed to update ready state. Please try again.');
    }
  };

  // Show message when not connected
  if (!isOnline || !partner?.email) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black">
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <ChatBubbleLeftRightIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Not Connected</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Connect with a partner to see and discuss topics together
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen h-screen flex flex-col bg-gray-50 dark:bg-black">
      {/* Fixed Header Section */}
      <div className="flex-none px-4 pt-4 pb-2 bg-gray-50 dark:bg-black border-b border-gray-200 dark:border-gray-800">
        {/* Header */}
        <div className="mb-3">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Topics</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Discuss and decide on important matters together
          </p>
        </div>

        {/* Categories */}
        <div className="-mx-4 px-4">
          <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
            {Object.entries(CATEGORY_ICONS).map(([category, Icon]) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`
                  flex-none inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap
                  ${selectedCategory === category
                    ? 'bg-black text-white dark:bg-white dark:text-black'
                    : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-black dark:text-gray-300 dark:hover:bg-gray-900 border border-gray-200 dark:border-gray-800'
                  }
                `}
              >
                <Icon className="h-4 w-4 mr-1.5" />
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Add Topic Form */}
        <form onSubmit={handleAddTopic} className="mt-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              placeholder="Enter a new topic..."
              className="flex-1 h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-black text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-black dark:focus:border-white"
              style={{ textTransform: 'capitalize' }}
            />
            <button
              type="submit"
              disabled={!newTopic.trim()}
              className={`h-10 px-4 inline-flex items-center justify-center border border-transparent rounded-lg text-sm font-medium transition-all duration-200 ${
                newTopic.trim() 
                  ? 'text-white bg-black hover:bg-gray-900 dark:bg-white dark:text-black dark:hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black dark:focus:ring-white dark:focus:ring-offset-black' 
                  : 'bg-gray-300 cursor-not-allowed dark:bg-gray-700 text-gray-500 dark:text-gray-400'
              }`}
            >
              <PlusIcon className="h-5 w-5" />
              <span className="sr-only">Add Topic</span>
            </button>
          </div>
          {formError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{formError}</p>
          )}
        </form>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-2 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-black border-t-transparent dark:border-white dark:border-t-transparent"></div>
            </div>
          ) : topics.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <ChatBubbleLeftRightIcon className="h-12 w-12 text-gray-400 dark:text-gray-600 mb-2" />
              <p className="text-gray-500 dark:text-gray-400">No topics yet. Add one to get started!</p>
            </div>
          ) : (
            filteredTopics.map(topic => (
              <TopicCard
                key={topic.id}
                topic={topic}
                user={user}
                partner={partner}
                onRespond={handleResponse}
                onReady={handleReadyState}
                onDiscuss={handleTopicView}
                onEdit={handleEditTopic}
                onDelete={handleDeleteTopic}
                unreadMessages={unreadMessagesByTopic[topic.id]}
              />
            ))
          )}
        </div>
      </div>

      {/* Chat Modal */}
      {selectedTopic && (
        <TopicChat
          topic={selectedTopic}
          onClose={handleCloseChat}
        />
      )}
    </div>
  );
};

export default Topics;