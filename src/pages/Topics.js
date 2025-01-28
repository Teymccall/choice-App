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
} from '@heroicons/react/24/outline';
import { ref, onValue, push, update, serverTimestamp } from 'firebase/database';
import { rtdb } from '../firebase/config';
import TopicChat from '../components/TopicChat';

const CATEGORY_ICONS = {
  'All': TagIcon,
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
  // eslint-disable-next-line no-unused-vars
  const [unreadResponses, setUnreadResponses] = useState({});
  const [unreadMessagesByTopic, setUnreadMessagesByTopic] = useState({});

  // Check for stored topic ID on mount and when topics change
  useEffect(() => {
    const storedTopicId = sessionStorage.getItem('openTopicChatId');
    if (storedTopicId && topics.length > 0) {
      const topic = topics.find(t => t.id === storedTopicId);
      if (topic) {
        setSelectedTopic(topic);
        // Clear the stored ID after opening
        sessionStorage.removeItem('openTopicChatId');
      }
    }
  }, [topics]);

  // Add event listener for opening chat from notifications
  useEffect(() => {
    const handleOpenChat = (event) => {
      const { topicId } = event.detail;
      const topic = topics.find(t => t.id === topicId);
      if (topic) {
        setSelectedTopic(topic);
        // Clear the stored ID since we're handling it
        sessionStorage.removeItem('openTopicChatId');
      }
    };

    window.addEventListener('openTopicChat', handleOpenChat);
    return () => window.removeEventListener('openTopicChat', handleOpenChat);
  }, [topics]);

  // Fetch topics
  useEffect(() => {
    // Clear topics immediately if not connected
    if (!user?.uid || !partner?.uid || !user?.email || !partner?.email || !isOnline) {
      setTopics([]);
      setLoading(false);
      return;
    }

    // Create a unique pairing ID using email addresses
    const getPairingId = (email1, email2) => {
      return [email1, email2].sort().join('_');
    };

    const currentPairingId = getPairingId(user.email, partner.email);
    const topicsRef = ref(rtdb, 'topics');
    
    const unsubscribe = onValue(topicsRef, (snapshot) => {
      try {
        // Clear topics if disconnected during fetch
        if (!isOnline || !partner?.email) {
          setTopics([]);
          setLoading(false);
          return;
        }

        const data = snapshot.val();
        if (!data) {
          setTopics([]);
          setLoading(false);
          return;
        }

        const filteredTopics = Object.entries(data)
          .map(([id, topic]) => ({
            id,
            ...topic,
            pairingId: topic.initiatorEmail && topic.initialPartnerEmail ? 
              getPairingId(topic.initiatorEmail, topic.initialPartnerEmail) : null
          }))
          .filter(topic => {
            // Only show topics for current pairing
            return (
              topic.pairingId === currentPairingId &&
              topic.participants?.includes(user.uid) &&
              topic.participants?.includes(partner.uid)
            );
          })
          .sort((a, b) => b.createdAt - a.createdAt);

        setTopics(filteredTopics);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching topics:', err);
        setError(err.message);
        setLoading(false);
      }
    });

    return () => {
      // Clean up listener and clear topics when unmounting or disconnecting
      setTopics([]);
      unsubscribe();
    };
  }, [user?.uid, user?.email, partner?.uid, partner?.email, isOnline]);

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
        createdAt: serverTimestamp(),
        participants: [user.uid, partner.uid],
        status: 'in_progress',
        responses: {},
        // Add email information for pairing
        initiatorEmail: user.email,
        initialPartnerEmail: partner.email
      };

      console.log('Adding new topic:', topicData);
      
      await update(newTopicRef, topicData);
      console.log('Topic added successfully');

      setNewTopic('');
      setFormError(null);
    } catch (err) {
      console.error('Error adding topic:', err);
      setFormError(err.message || 'Failed to add topic. Please try again.');
    }
  };

  const handleResponse = async (topicId, response) => {
    if (!isOnline) return;

    try {
      const topicRef = ref(rtdb, `topics/${topicId}`);
      const responseData = {
        userId: user.uid,
        response,
        timestamp: serverTimestamp()
      };

      await update(topicRef, {
        [`responses/${user.uid}`]: responseData
      });

      // Send notification to partner
      if (partner?.uid) {
        const notificationRef = ref(rtdb, `notifications/${partner.uid}`);
        const notificationData = {
          type: 'topic_response',
          senderName: user.displayName || 'Your partner',
          topicTitle: topics.find(t => t.id === topicId)?.question || 'a topic',
          timestamp: serverTimestamp()
        };
        
        await update(notificationRef, {
          [Date.now()]: notificationData
        });
      }

      // Check if both partners have responded
      const topic = topics.find(t => t.id === topicId);
      if (topic) {
        const responses = { 
          ...topic.responses, 
          [user.uid]: responseData 
        };
        
        if (responses[user.uid] && responses[partner?.uid]) {
          await update(topicRef, {
            status: 'completed'
          });
        }
      }
    } catch (err) {
      console.error('Error updating response:', err);
      setError(err.message);
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

  // Add cleanup when closing chat
  const handleCloseChat = () => {
    // Clear the stored topic ID
    sessionStorage.removeItem('openTopicChatId');
    setSelectedTopic(null);
  };

  // eslint-disable-next-line no-unused-vars
  const categories = ['All', 'Relationship', 'Household', 'Future', 'Communication', 'Custom'];

  const filteredTopics = !topics ? [] : (
    selectedCategory === 'All'
    ? topics
    : topics.filter(topic => topic?.category === selectedCategory)
  );

  // Show message when not connected
  if (!isOnline || !partner?.email) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <ChatBubbleLeftRightIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-500">Not Connected</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Connect with a partner to see and discuss topics together
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 dark:border-primary-400 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading topics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-50 text-red-700 p-4 rounded-lg dark:bg-red-900 dark:text-red-300">
            <p>Error loading topics: {error}</p>
            <button 
              onClick={() => setError(null)}
              className="mt-2 text-sm text-red-600 dark:text-red-400 hover:text-red-800"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-16 pb-20 sm:pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Topics</h1>
            <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
              Discuss and decide on important matters together
            </p>
          </div>
        </div>

        <div className="mb-6">
          {/* Desktop Categories */}
          <div className="hidden sm:flex flex-wrap gap-2">
            {Object.entries(CATEGORY_ICONS).map(([category, Icon]) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${
                  selectedCategory === category
                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-400'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                }`}
              >
                <Icon className="h-5 w-5 mr-1.5" />
                {category}
              </button>
            ))}
          </div>

          {/* Mobile Categories Horizontal Scroll */}
          <div className="sm:hidden overflow-x-auto pb-2 -mx-4 px-4">
            <div className="flex gap-2 min-w-max">
              {Object.entries(CATEGORY_ICONS).map(([category, Icon]) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors duration-200 whitespace-nowrap ${
                    selectedCategory === category
                      ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-400'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon className="h-4 w-4 mr-1" />
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>

        <form onSubmit={handleAddTopic} className="mb-8">
          <div className="flex flex-col gap-4">
            <div className="flex gap-4">
              <input
                type="text"
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                placeholder="Enter a new topic..."
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
              <button
                type="submit"
                disabled={!isOnline}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-primary-500 dark:hover:bg-primary-600"
              >
                <PlusIcon className="h-5 w-5 mr-1.5" />
                Add Topic
              </button>
            </div>
            {formError && (
              <div className="text-sm text-red-600 dark:text-red-400">
                {formError}
              </div>
            )}
          </div>
        </form>

        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 dark:border-primary-400 mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Loading topics...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
          ) : filteredTopics.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-400">
                {topics.length === 0 ? "No topics yet. Add one to get started!" : "No topics found in this category."}
              </p>
            </div>
          ) : (
            filteredTopics.map((topic) => (
              <div
                key={topic.id}
                className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 transition-all duration-200 ${
                  selectedTopic?.id === topic.id ? 'ring-2 ring-primary-500' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">{topic.question}</h3>
                    <div className="mt-1 flex items-center space-x-4">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        Created {formatDate(topic.createdAt)}
                      </span>
                      {topic.category && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                          {topic.category}
                        </span>
                      )}
                    </div>
                    {/* Response Status Section */}
                    <div className="mt-2">
                      {topic.responses?.[user.uid]?.response && !topic.responses?.[partner.uid]?.response && (
                        <p className="text-sm text-yellow-600 dark:text-yellow-400 flex items-center">
                          <span className="inline-block w-2 h-2 bg-yellow-400 rounded-full mr-2 animate-pulse"></span>
                          Waiting for partner's response...
                        </p>
                      )}
                      {topic.responses?.[partner.uid]?.response && !topic.responses?.[user.uid]?.response && (
                        <p className="text-sm text-blue-600 dark:text-blue-400">
                          Partner has responded - your turn!
                        </p>
                      )}
                      {topic.responses?.[user.uid]?.response && topic.responses?.[partner.uid]?.response && (
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Your response:</span>
                            <span className={`text-sm flex items-center ${
                              topic.responses[user.uid].response === 'agree' 
                                ? 'text-green-600 dark:text-green-400' 
                                : 'text-red-600 dark:text-red-400'
                            }`}>
                              {topic.responses[user.uid].response === 'agree' ? (
                                <HandThumbUpIcon className="h-4 w-4 mr-1" />
                              ) : (
                                <HandThumbDownIcon className="h-4 w-4 mr-1" />
                              )}
                              {topic.responses[user.uid].response === 'agree' ? 'Agree' : 'Disagree'}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Partner's response:</span>
                            <span className={`text-sm flex items-center ${
                              topic.responses[partner.uid].response === 'agree' 
                                ? 'text-green-600 dark:text-green-400' 
                                : 'text-red-600 dark:text-red-400'
                            }`}>
                              {topic.responses[partner.uid].response === 'agree' ? (
                                <HandThumbUpIcon className="h-4 w-4 mr-1" />
                              ) : (
                                <HandThumbDownIcon className="h-4 w-4 mr-1" />
                              )}
                              {topic.responses[partner.uid].response === 'agree' ? 'Agree' : 'Disagree'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    {/* Decision Buttons */}
                    {!topic.responses?.[user.uid]?.response && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleResponse(topic.id, 'agree')}
                          className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/50 dark:text-green-400 dark:hover:bg-green-900/70 transition-colors"
                        >
                          <HandThumbUpIcon className="h-5 w-5 mr-1" />
                          Agree
                        </button>
                        <button
                          onClick={() => handleResponse(topic.id, 'disagree')}
                          className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-400 dark:hover:bg-red-900/70 transition-colors"
                        >
                          <HandThumbDownIcon className="h-5 w-5 mr-1" />
                          Disagree
                        </button>
                      </div>
                    )}
                    {/* Response Indicator */}
                    <div className="flex items-center space-x-2">
                      {topic.responses?.[user.uid]?.response === 'agree' && (
                        <HandThumbUpIcon className="h-5 w-5 text-green-500" />
                      )}
                      {topic.responses?.[user.uid]?.response === 'disagree' && (
                        <HandThumbDownIcon className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                    {/* Chat Button */}
                    <button
                      onClick={() => handleTopicView(topic)}
                      className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium ${
                        selectedTopic?.id === topic.id
                          ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-400'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
                      }`}
                    >
                      <ChatBubbleLeftRightIcon className="h-5 w-5 mr-1" />
                      Discuss
                      {unreadMessagesByTopic[topic.id] && (
                        <span className="ml-1.5 flex h-2 w-2 rounded-full bg-red-500"></span>
                      )}
                    </button>
                  </div>
                </div>
                {selectedTopic?.id === topic.id && (
                  <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">Discussion</h3>
                      <button
                        onClick={handleCloseChat}
                        className="inline-flex items-center px-2 py-1 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    </div>
                    <TopicChat topic={topic} onClose={handleCloseChat} />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Topics; 