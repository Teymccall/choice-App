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
import TopicItem from '../components/TopicItem';
import { formatDate } from '../utils/dateUtils';

// Constants
const CATEGORY_ICONS = {
  'All': HashtagIcon,
  'Relationship': HeartIcon,
  'Household': HomeIcon,
  'Future': RocketLaunchIcon,
  'Communication': ChatBubbleLeftRightIcon,
  'Custom': UserIcon,
};

// Components
const LoadingSpinner = () => (
  <div className="flex items-center justify-center py-4">
    <div className="animate-spin rounded-full h-8 w-8 border-2 border-black border-t-transparent dark:border-white dark:border-t-transparent"></div>
  </div>
);

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
    <ChatBubbleLeftRightIcon className="h-12 w-12 text-gray-400 dark:text-gray-600 mb-2" />
    <p className="text-gray-500 dark:text-gray-400">No topics yet. Add one to get started!</p>
  </div>
);

const NotConnected = () => (
  <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
    <UserIcon className="h-12 w-12 text-gray-400 dark:text-gray-600 mb-2" />
    <p className="text-gray-500 dark:text-gray-400">Connect with a partner to start discussing topics!</p>
  </div>
);

// Main component
function Topics() {
  const { user, partner, isOnline } = useAuth();
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [showAddTopic, setShowAddTopic] = useState(false);
  const [newTopicQuestion, setNewTopicQuestion] = useState('');
  const [newTopicCategory, setNewTopicCategory] = useState('Custom');
  const [unreadMessagesByTopic, setUnreadMessagesByTopic] = useState({});
  const [unreadResponses, setUnreadResponses] = useState({});

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
    if (!user?.uid || !partner?.uid) return;

    const topicsRef = ref(rtdb, 'topics');
    const unsubscribe = onValue(topicsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setTopics([]);
        setLoading(false);
        return;
      }

      const topicsArray = Object.entries(data)
        .filter(([_, topic]) => {
          return (topic.createdBy === user.uid && topic.partnerId === partner.uid) ||
                 (topic.createdBy === partner.uid && topic.partnerId === user.uid);
        })
        .map(([id, topic]) => ({
          id,
          ...topic
        }))
        .sort((a, b) => {
          // Sort by completion status and then by creation date
          if (a.status === 'completed' && b.status !== 'completed') return 1;
          if (a.status !== 'completed' && b.status === 'completed') return -1;
          return b.createdAt - a.createdAt;
        });

      setTopics(topicsArray);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid, partner?.uid]);

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

  // Add effect to track unread chat messages
  useEffect(() => {
    if (!user?.uid || !topics.length) return;

    // Create refs for all topics to monitor their chats
    const unsubscribes = topics.map(topic => {
      const chatRef = ref(rtdb, `topicChats/${topic.id}`);
      return onValue(chatRef, (snapshot) => {
        const messages = snapshot.val();
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

  // Early return if no user or partner
  if (!user || !partner) {
    return <NotConnected />;
  }

  const handleAddTopic = async (e) => {
    e.preventDefault();
    setError(null);
    
    if (!newTopicQuestion.trim()) {
      setError('Please enter a topic');
      return;
    }
    
    if (!isOnline) {
      setError('You must be online to add topics');
      return;
    }
    
    if (!partner) {
      setError('You need to connect with a partner first');
      return;
    }

    try {
      const topicsRef = ref(rtdb, 'topics');
      const newTopicRef = push(topicsRef);
      
      const topicData = {
        question: newTopicQuestion.trim(),
        category: newTopicCategory === 'All' ? 'Custom' : newTopicCategory,
        createdBy: user.uid,
        creatorName: user.displayName || 'Anonymous',
        partnerId: partner.uid,
        partnerName: partner.displayName || 'Partner',
        createdAt: serverTimestamp(),
        status: 'active',
        responses: {}
      };
      
      await set(newTopicRef, topicData);
      setNewTopicQuestion('');
      setError(null);
    } catch (err) {
      console.error('Error adding topic:', err);
      setError(err.message || 'Failed to add topic. Please try again.');
    }
  };

  const handleResponse = async (topicId, response) => {
    console.log('Handling response:', { topicId, response }); // Add debugging

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
      console.log('Topic data:', topicData); // Add debugging
      
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

      // Update the response and status
      const responseUpdate = {
        [`responses/${user.uid}`]: {
          response: response,
          timestamp: serverTimestamp(),
          userName: user.displayName || 'Anonymous'
        },
        status: 'waiting', // Indicate that we're waiting for the other person
        lastResponseBy: user.uid,
        lastResponseAt: serverTimestamp()
      };

      // If partner has already responded, update topic status to completed
      if (topicData.responses?.[partner.uid]?.response !== undefined) {
        responseUpdate.status = 'completed';
        responseUpdate.completedAt = serverTimestamp();
      }

      console.log('Updating with:', responseUpdate); // Add debugging
      await update(topicRef, responseUpdate);
      console.log('Update successful'); // Add debugging

      // Send notification to partner
      if (partner?.uid) {
        const notificationRef = ref(rtdb, `notifications/${partner.uid}`);
        const notificationData = {
          type: 'topic_response',
          title: 'New Decision',
          body: topicData.responses?.[partner.uid]?.response !== undefined
            ? `${user.displayName || 'Your partner'} has also made their decision for "${topicData.question}"`
            : `${user.displayName || 'Your partner'} has made their decision for "${topicData.question}" - waiting for your response`,
          topicId: topicId,
          timestamp: serverTimestamp(),
          status: responseUpdate.status
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

      // Update ready state and status
      const updates = {
        [`readyState/${user.uid}`]: isReady,
        status: 'pending'
      };

      // Check if both users are ready
      const partnerReady = topicData.readyState?.[partner.uid] || false;
      if (isReady && partnerReady) {
        updates.status = 'ready';
      }

      await update(topicRef, updates);

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

  const handleDiscuss = (topicId) => {
    const topic = topics.find(t => t.id === topicId);
    if (topic) {
      setSelectedTopic(topic);
    }
  };

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
              value={newTopicQuestion}
              onChange={(e) => setNewTopicQuestion(e.target.value)}
              placeholder="Enter a new topic..."
              className="flex-1 h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-black text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-black dark:focus:border-white"
              style={{ textTransform: 'capitalize' }}
            />
            <button
              type="submit"
              disabled={!newTopicQuestion.trim()}
              className={`h-10 px-4 inline-flex items-center justify-center border border-transparent rounded-lg text-sm font-medium transition-all duration-200 ${
                newTopicQuestion.trim() 
                  ? 'text-white bg-black hover:bg-gray-900 dark:bg-white dark:text-black dark:hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black dark:focus:ring-white dark:focus:ring-offset-black' 
                  : 'bg-gray-300 cursor-not-allowed dark:bg-gray-700 text-gray-500 dark:text-gray-400'
              }`}
            >
              <PlusIcon className="h-5 w-5" />
              <span className="sr-only">Add Topic</span>
            </button>
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </form>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-2 space-y-3">
          {loading ? (
            <LoadingSpinner />
          ) : topics.length === 0 ? (
            <EmptyState />
          ) : (
            filteredTopics.map(topic => (
              <TopicItem
                key={topic.id}
                topic={topic}
                onReady={handleReadyState}
                onResponse={handleResponse}
                onDiscuss={handleDiscuss}
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
}

// Export the component
export default Topics;