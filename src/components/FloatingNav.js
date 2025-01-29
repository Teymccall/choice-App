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
  const [pendingResponses, setPendingResponses] = useState(0);
  const [unreadChats, setUnreadChats] = useState(0);
  const [newTopics, setNewTopics] = useState(0);
  const menuRef = useRef(null);
  const { user, partner } = useAuth();

  const navItems = [
    { path: '/dashboard', name: 'Dashboard', icon: HomeIcon },
    { 
      path: '/topics', 
      name: 'Topics', 
      icon: ChatBubbleLeftRightIcon,
      badge: (unreadChats > 0 || pendingResponses > 0 || newTopics > 0) ? 
        {
          messages: location.pathname !== '/topics' && unreadChats > 0,
          responses: location.pathname !== '/topics' && pendingResponses > 0,
          topics: location.pathname !== '/topics' && newTopics > 0
        } : null
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
    if (!user?.uid || !partner?.uid) return;

    const topicsRef = ref(rtdb, 'topics');
    
    const unsubscribe = onValue(topicsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setPendingResponses(0);
        setNewTopics(0);
        return;
      }

      // Check for new topics
      const lastCheckedTopics = parseInt(localStorage.getItem(`lastChecked_topics_${user.uid}`)) || 0;
      const newTopicsCount = Object.values(data).filter(topic => 
        topic.createdAt > lastCheckedTopics && topic.createdBy !== user.uid
      ).length;
      setNewTopics(newTopicsCount);

      // Check for new responses
      const responsesCount = location.pathname !== '/topics' ? Object.values(data).filter(topic => {
        if (!topic.responses || !topic.responses[partner.uid]) return false;
        const lastChecked = parseInt(localStorage.getItem(`lastChecked_${topic.id}_${user.uid}`)) || 0;
        const partnerResponseTime = parseInt(topic.responses[partner.uid].timestamp);
        return partnerResponseTime > lastChecked && !topic.responses[user.uid];
      }).length : 0;
      
      setPendingResponses(responsesCount);
    });

    return () => unsubscribe();
  }, [user?.uid, partner?.uid, location.pathname]);

  // Track unread chats
  useEffect(() => {
    if (!user?.uid) return;

    const chatsRef = ref(rtdb, 'topicChats');
    
    const unsubscribe = onValue(chatsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setUnreadChats(0);
        return;
      }

      let unreadCount = 0;
      Object.entries(data).forEach(([topicId, chat]) => {
        if (!chat?.messages) return;
        
        const lastReadTimestamp = parseInt(localStorage.getItem(`lastRead_${topicId}_${user.uid}`)) || 0;
        const isTopicOpen = sessionStorage.getItem('openTopicChatId') === topicId;
        
        if (isTopicOpen) {
          localStorage.setItem(`lastRead_${topicId}_${user.uid}`, Date.now().toString());
          return;
        }
        
        const unreadMessages = Object.values(chat.messages).filter(message => 
          message.userId !== user.uid && 
          parseInt(message.timestamp) > lastReadTimestamp
        );
        
        unreadCount += unreadMessages.length;
      });

      setUnreadChats(unreadCount);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  if (!user) return null;

  const totalNotifications = (unreadChats || 0) + (pendingResponses || 0) + (newTopics || 0);

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
          <XMarkIcon className="w-5 h-5 text-white" />
        ) : (
          <>
            <Bars3Icon className="w-5 h-5 text-white" />
            {totalNotifications > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs 
                rounded-full h-5 w-5 flex items-center justify-center">
                {totalNotifications}
              </span>
            )}
          </>
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
              className={`flex items-center space-x-3 px-4 py-3
                ${location.pathname === item.path 
                  ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' 
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              onClick={() => setIsOpen(false)}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.name}</span>
              {item.badge && (
                <div className="ml-auto flex space-x-1">
                  {item.badge.messages && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs">
                      {unreadChats}
                    </span>
                  )}
                  {item.badge.responses && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 text-xs">
                      {pendingResponses}
                    </span>
                  )}
                  {item.badge.topics && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs">
                      {newTopics}
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
