import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  Bars3Icon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { ref, onValue } from 'firebase/database';
import { rtdb } from '../firebase/config';

const FloatingNav = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const { user, partner } = useAuth();
  const [unreadChats, setUnreadChats] = useState(0);
  const [pendingResponses, setPendingResponses] = useState(0);
  const [newTopics, setNewTopics] = useState(0);

  const navItems = [
    { path: '/dashboard', name: 'Dashboard', icon: HomeIcon },
    { 
      path: '/topics', 
      name: 'Topics', 
      icon: ChatBubbleLeftRightIcon,
      badge: {
        messages: true,
        responses: true,
        topics: true
      }
    },
    { path: '/results', name: 'Results', icon: ChartBarIcon },
    { path: '/settings', name: 'Settings', icon: Cog6ToothIcon },
  ];

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Track notifications and unread messages
  useEffect(() => {
    if (!user?.uid || !partner?.uid) {
      // Reset counts if no partner
      setNewTopics(0);
      setPendingResponses(0);
      setUnreadChats(0);
      return;
    }

    const topicsRef = ref(rtdb, 'topics');
    
    const unsubscribe = onValue(topicsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setPendingResponses(0);
        setNewTopics(0);
        return;
      }

      // Get the last checked timestamp for topics
      const lastCheckedTopics = parseInt(
        localStorage.getItem(`lastChecked_topics_${user.uid}`)
      ) || Date.now();

      let newTopicsCount = 0;
      let pendingResponsesCount = 0;

      Object.entries(data).forEach(([topicId, topic]) => {
        // Only count topics that involve both current user and current partner
        const isRelevantTopic = (topic.createdBy === user.uid && topic.partnerId === partner.uid) ||
                               (topic.createdBy === partner.uid && topic.partnerId === user.uid);
        
        if (!isRelevantTopic) return;

        // Check for new topics
        if (topic.createdAt > lastCheckedTopics && topic.createdBy === partner.uid) {
          newTopicsCount++;
        }

        // Check for new responses
        if (topic.responses?.[partner.uid]) {
          const lastChecked = parseInt(localStorage.getItem(`lastChecked_${topicId}_${user.uid}`)) || 0;
          const responseTime = topic.responses[partner.uid].timestamp;
          
          if (responseTime > lastChecked && !topic.responses[user.uid]) {
            pendingResponsesCount++;
          }
        }
      });
      
      setNewTopics(newTopicsCount);
      setPendingResponses(pendingResponsesCount);
    });

    return () => unsubscribe();
  }, [user?.uid, partner?.uid]);

  // Listen for chat updates
  useEffect(() => {
    if (!user?.uid || !partner?.uid) return;

    const chatsRef = ref(rtdb, 'topicChats');
    const unsubscribe = onValue(chatsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setUnreadChats(0);
        return;
      }

      let unreadCount = 0;
      Object.entries(data).forEach(([topicId, chat]) => {
        if (!chat) return;

        const lastReadTimestamp = parseInt(localStorage.getItem(`lastRead_${topicId}_${user.uid}`)) || 0;
        const isTopicOpen = sessionStorage.getItem('openTopicChatId') === topicId;
        
        // Skip counting for open topics and update lastRead timestamp
        if (isTopicOpen) {
          localStorage.setItem(`lastRead_${topicId}_${user.uid}`, Date.now().toString());
          return;
        }

        Object.entries(chat).forEach(([messageId, message]) => {
          if (messageId === 'typing') return; // Skip typing status entries
          
          const messageTimestamp = message.timestamp ? 
            (typeof message.timestamp === 'number' ? 
              message.timestamp : 
              message.timestamp?.toMillis?.() || 
              parseInt(message.timestamp) || 
              Date.now()
            ) : Date.now();

          if (message.userId === partner.uid && 
              message.partnerId === user.uid && 
              messageTimestamp > lastReadTimestamp) {
            unreadCount++;
          }
        });
      });

      setUnreadChats(unreadCount);
    });

    return () => unsubscribe();
  }, [user?.uid, partner?.uid]);

  // Add effect to clear unread messages when viewing a topic
  useEffect(() => {
    const handleStorageChange = () => {
      const openTopicId = sessionStorage.getItem('openTopicChatId');
      if (openTopicId && user?.uid) {
        localStorage.setItem(`lastRead_${openTopicId}_${user.uid}`, Date.now().toString());
        // Force a recount of unread messages
        const chatsRef = ref(rtdb, 'topicChats');
        onValue(chatsRef, (snapshot) => {
          const data = snapshot.val();
          if (!data) {
            setUnreadChats(0);
            return;
          }

          let unreadCount = 0;
          Object.entries(data).forEach(([topicId, chat]) => {
            if (!chat || topicId === openTopicId) return;

            const lastReadTimestamp = parseInt(localStorage.getItem(`lastRead_${topicId}_${user.uid}`)) || 0;

            Object.entries(chat).forEach(([messageId, message]) => {
              if (messageId === 'typing') return;
              
              const messageTimestamp = message.timestamp ? 
                (typeof message.timestamp === 'number' ? 
                  message.timestamp : 
                  message.timestamp?.toMillis?.() || 
                  parseInt(message.timestamp) || 
                  Date.now()
                ) : Date.now();

              if (message.userId === partner.uid && 
                  message.partnerId === user.uid && 
                  messageTimestamp > lastReadTimestamp) {
                unreadCount++;
              }
            });
          });

          setUnreadChats(unreadCount);
        }, { onlyOnce: true });
      }
    };

    // Initial check
    handleStorageChange();

    // Listen for changes to sessionStorage
    window.addEventListener('storage', handleStorageChange);
    // Listen for custom event when topic is opened
    window.addEventListener('topicChatOpened', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('topicChatOpened', handleStorageChange);
    };
  }, [user?.uid, partner?.uid]);

  // Clear badges when navigating to topics page
  useEffect(() => {
    if (location.pathname === '/topics' && user?.uid) {
      localStorage.setItem(`lastChecked_topics_${user.uid}`, Date.now().toString());
      setNewTopics(0);
    }
  }, [location.pathname, user?.uid]);

  if (!user) return null;

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-4 left-4 w-12 h-12 rounded-full shadow-lg 
          flex items-center justify-center transition-all duration-200 z-50
          ${isOpen 
            ? 'bg-gray-700 dark:bg-gray-600' 
            : 'bg-primary-500 hover:bg-primary-600 dark:bg-primary-600'}`}
      >
        {isOpen ? (
          <XMarkIcon className="h-5 w-5 text-white" />
        ) : (
          <div className="relative">
            <Bars3Icon className="h-5 w-5 text-white" />
            {(unreadChats > 0 || pendingResponses > 0 || newTopics > 0) && (
              <span className="absolute -top-2 -right-2 flex h-5 w-5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500 text-white text-xs items-center justify-center">
                  {unreadChats + pendingResponses + newTopics}
                </span>
              </span>
            )}
          </div>
        )}
      </button>

      {/* Navigation Menu */}
      {isOpen && (
        <div
          ref={menuRef}
          className="fixed bottom-20 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-xl 
            py-2 min-w-[200px] z-50 flex flex-col
            max-h-[calc(100vh-10rem)] sm:max-h-[60vh] overflow-y-auto"
        >
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center justify-between px-4 py-3 relative
                ${location.pathname === item.path 
                  ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' 
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              onClick={() => setIsOpen(false)}
            >
              <div className="flex items-center">
                <item.icon className="h-5 w-5 mr-3" />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <div className="flex items-center space-x-2">
                  {unreadChats > 0 && item.badge.messages && (
                    <span className="flex items-center justify-center h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900/30">
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                        {unreadChats}
                      </span>
                    </span>
                  )}
                  {pendingResponses > 0 && item.badge.responses && (
                    <span className="flex items-center justify-center h-5 w-5 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
                      <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
                        {pendingResponses}
                      </span>
                    </span>
                  )}
                  {newTopics > 0 && item.badge.topics && (
                    <span className="flex items-center justify-center h-5 w-5 rounded-full bg-green-100 dark:bg-green-900/30">
                      <span className="text-xs font-medium text-green-600 dark:text-green-400">
                        {newTopics}
                      </span>
                    </span>
                  )}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </>
  );
};

export default FloatingNav; 
