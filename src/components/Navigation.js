import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  HomeIcon,
  UserGroupIcon,
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  ArrowRightOnRectangleIcon,
  Cog6ToothIcon,
  UserCircleIcon,
  BellIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { ref, onValue, remove, update } from 'firebase/database';
import { rtdb } from '../firebase/config';
import Notifications from './Notifications';

const Navigation = () => {
  const { user, logout, partner } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [pendingResponses, setPendingResponses] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadChats, setUnreadChats] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [newTopics, setNewTopics] = useState(0);
  const [newDecisions, setNewDecisions] = useState(0);
  const [hasUnreadItems, setHasUnreadItems] = useState(false);

  // Close notifications when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showNotifications && !event.target.closest('.notifications-container')) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showNotifications]);

  useEffect(() => {
    if (location.pathname === '/topics') {
      // Clear new topics notification when visiting Topics page
      localStorage.setItem(`lastChecked_topics_${user?.uid}`, Date.now().toString());
      setNewTopics(0);
    }
  }, [location.pathname, user?.uid]);

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

      // Check for new responses, but only if we're not on the topics page
      const responsesCount = location.pathname !== '/topics' ? Object.values(data).filter(topic => {
        if (!topic.responses || !topic.responses[partner.uid]) return false;
        
        const lastChecked = parseInt(localStorage.getItem(`lastChecked_${topic.id}_${user.uid}`)) || 0;
        const partnerResponseTime = parseInt(topic.responses[partner.uid].timestamp);
        
        // Only count if partner responded after our last check AND we haven't responded yet
        return partnerResponseTime > lastChecked && !topic.responses[user.uid];
      }).length : 0;
      
      setPendingResponses(responsesCount);
    });

    return () => unsubscribe();
  }, [user?.uid, partner?.uid, location.pathname]);

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
        
        // If the topic is currently open, don't count its messages as unread
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

  // Add effect to clear badges when viewing topics
  useEffect(() => {
    if (location.pathname === '/topics') {
      // Clear new topics badge
      localStorage.setItem(`lastChecked_topics_${user?.uid}`, Date.now().toString());
      setNewTopics(0);
      
      // If a topic is open, clear its badges
      const openTopicId = sessionStorage.getItem('openTopicChatId');
      if (openTopicId) {
        localStorage.setItem(`lastRead_${openTopicId}_${user?.uid}`, Date.now().toString());
        localStorage.setItem(`lastChecked_${openTopicId}_${user?.uid}`, Date.now().toString());
      }
    }
  }, [location.pathname, user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;

    const notificationsRef = ref(rtdb, `notifications/${user.uid}`);
    
    const unsubscribe = onValue(notificationsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setNotifications([]);
        return;
      }

      // Sort notifications by timestamp, newest first
      const notificationsList = Object.entries(data)
        .map(([id, notification]) => ({
          id,
          ...notification,
          timestamp: parseInt(notification.timestamp) // Ensure timestamp is a number
        }))
        .sort((a, b) => b.timestamp - a.timestamp);

      console.log('Current notifications:', notificationsList); // Debug log
      setNotifications(notificationsList);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid || !partner?.uid) return;

    // Listen for chat messages
    const topicsRef = ref(rtdb, 'topics');
    const unsubscribe = onValue(topicsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      let hasUnread = false;

      // Check each topic for unread messages or responses
      Object.entries(data).forEach(([topicId, topic]) => {
        // Check for unread messages
        const chatRef = ref(rtdb, `topicChats/${topicId}`);
        onValue(chatRef, (chatSnapshot) => {
          const messages = chatSnapshot.val();
          if (!messages) return;

          const lastReadTimestamp = parseInt(localStorage.getItem(`lastRead_${topicId}_${user.uid}`)) || 0;
          const hasUnreadMessages = Object.values(messages).some(message => 
            message.userId !== user.uid && 
            message.timestamp > lastReadTimestamp
          );

          // Check for unread responses
          const partnerResponse = topic.responses?.[partner.uid];
          const lastCheckedResponse = parseInt(localStorage.getItem(`lastChecked_${topicId}_${user.uid}`)) || 0;
          const hasUnreadResponse = partnerResponse && partnerResponse.timestamp > lastCheckedResponse;

          if (hasUnreadMessages || hasUnreadResponse) {
            hasUnread = true;
          }
        });
      });

      setHasUnreadItems(hasUnread);
    });

    return () => unsubscribe();
  }, [user?.uid, partner?.uid]);

  if (!user || location.pathname === '/login') return null;

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

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleNotificationClick = (e) => {
    e.stopPropagation(); // Prevent event bubbling
    setShowNotifications(!showNotifications);
  };

  const handleClearNotification = async (notificationId) => {
    if (!user?.uid) return;
    const notificationRef = ref(rtdb, `notifications/${user.uid}/${notificationId}`);
    await remove(notificationRef);
  };

  // Render notification dropdown
  const renderNotificationsDropdown = () => {
    if (!showNotifications) return null;
    
    return (
      <div className="absolute right-0 mt-2 w-80 z-50 notifications-container">
        <Notifications
          notifications={notifications}
          onClose={() => setShowNotifications(false)}
          onClearNotification={handleClearNotification}
        />
      </div>
    );
  };

  // Move the notification button to a separate component for reuse
  const NotificationButton = ({ onClick, unreadCount }) => (
    <button 
      className="p-2 rounded-full hover:bg-gray-100 transition-colors duration-200 relative"
      onClick={onClick}
    >
      <BellIcon className="h-6 w-6 text-gray-500" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 flex h-5 w-5">
          <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500 text-xs text-white items-center justify-center">
            {unreadCount}
          </span>
        </span>
      )}
    </button>
  );

  return (
    <nav className="fixed top-0 left-0 right-0 z-50">
      <div className="bg-white dark:bg-gray-800 shadow-md border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            {/* Logo section */}
            <div className="flex-shrink-0 flex items-center">
              <Link to="/" className="flex flex-col items-center group">
                <img 
                  src="/choice.png" 
                  alt="Choice App" 
                  className="h-8 w-auto"
                />
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Make decisions together
                </span>
              </Link>
            </div>

            {/* Navigation Items - Desktop */}
            <div className="hidden sm:flex sm:space-x-6">
              {navItems.map(({ path, name, icon: Icon, badge }) => (
                <Link
                  key={path}
                  to={path}
                  className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md relative transition-colors duration-200 ${
                    location.pathname === path
                      ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
                      : 'text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <Icon className="h-5 w-5 mr-1.5" />
                  {name}
                  {badge && (
                    <div className="absolute -top-2 -right-1 flex space-x-1">
                      {badge.messages && (
                        <span className="relative flex h-5 w-5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-5 w-5 bg-blue-500 text-white text-xs items-center justify-center">
                            {unreadChats}
                          </span>
                        </span>
                      )}
                      {badge.responses && (
                        <span className="relative flex h-5 w-5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-5 w-5 bg-yellow-500 text-white text-xs items-center justify-center">
                            {pendingResponses}
                          </span>
                        </span>
                      )}
                      {badge.topics && (
                        <span className="relative flex h-5 w-5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-5 w-5 bg-green-500 text-white text-xs items-center justify-center">
                            {newTopics}
                          </span>
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              ))}
            </div>

            {/* User Menu - Desktop */}
            <div className="hidden sm:flex sm:items-center sm:space-x-4">
              {/* Notifications */}
              <div className="relative notifications-container">
                <button
                  onClick={handleNotificationClick}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 relative"
                >
                  <BellIcon className="h-6 w-6 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400" />
                  {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 rounded-full bg-red-500 text-xs text-white items-center justify-center">
                      {notifications.length}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Notifications</h3>
                      {notifications.length > 0 && (
                        <button
                          onClick={async () => {
                            if (!user?.uid) return;
                            const notificationsRef = ref(rtdb, `notifications/${user.uid}`);
                            await remove(notificationsRef);
                          }}
                          className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium"
                        >
                          Clear All
                        </button>
                      )}
                    </div>
                    <div className="max-h-[70vh] overflow-y-auto">
                      <div className="space-y-4 p-4">
                        {notifications.length > 0 ? (
                          notifications.map((notification) => (
                            <div 
                              key={notification.id} 
                              className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                            >
                              <div className="flex-1">
                                <p className="text-sm text-gray-900 dark:text-white">{notification.message}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {new Date(notification.timestamp).toLocaleString()}
                                </p>
                              </div>
                              <button
                                onClick={() => handleClearNotification(notification.id)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                              >
                                <span className="sr-only">Dismiss</span>
                                <XMarkIcon className="h-5 w-5" />
                              </button>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                            No notifications
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* User Profile & Logout */}
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                    <UserCircleIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{user.displayName || user.email}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200"
                >
                  <ArrowRightOnRectangleIcon className="h-5 w-5 mr-1.5" />
                  Logout
                </button>
              </div>
            </div>

            {/* Mobile menu */}
            <div className="sm:hidden">
              <div className="flex items-center space-x-3">
                {/* Mobile Notification Bell */}
                <button
                  onClick={handleNotificationClick}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 relative"
                >
                  <BellIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                  {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 rounded-full bg-red-500 text-xs text-white items-center justify-center">
                      {notifications.length}
                    </span>
                  )}
                </button>
                
                {/* Mobile User Profile & Logout */}
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate max-w-[100px]">
                    {user.displayName || user.email}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <ArrowRightOnRectangleIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Notifications Dropdown */}
      {showNotifications && (
        <div className="sm:hidden fixed top-16 left-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Notifications</h3>
            {notifications.length > 0 && (
              <button
                onClick={async () => {
                  if (!user?.uid) return;
                  const notificationsRef = ref(rtdb, `notifications/${user.uid}`);
                  await remove(notificationsRef);
                }}
                className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium"
              >
                Clear All
              </button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            <div className="space-y-4 p-4">
              {notifications.length > 0 ? (
                notifications.map((notification) => (
                  <div 
                    key={notification.id} 
                    className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                    onClick={() => {
                      if (notification.type === 'chat_message') {
                        sessionStorage.setItem('openChatTopicId', notification.topicId);
                        if (window.location.pathname === '/topics') {
                          window.dispatchEvent(new CustomEvent('openTopicChat', {
                            detail: { topicId: notification.topicId }
                          }));
                        } else {
                          navigate('/topics');
                        }
                        setShowNotifications(false);
                      } else if (notification.type === 'topic_response') {
                        // Handle topic response notification
                        navigate('/topics');
                        setShowNotifications(false);
                      }
                    }}
                  >
                    <div className="flex-1">
                      {notification.type === 'topic_response' ? (
                        <>
                          <p className="text-sm text-gray-900 dark:text-white">
                            {notification.senderName} responded to "{notification.topicTitle}"
                          </p>
                          <p className="text-xs text-primary-600 dark:text-primary-400 mt-1">
                            Tap to view their response
                          </p>
                        </>
                      ) : notification.type === 'chat_message' ? (
                        <>
                          <p className="text-sm text-gray-900 dark:text-white">
                            New message from {notification.senderName} in "{notification.topicTitle}"
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {notification.message}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-gray-900 dark:text-white">{notification.message}</p>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {new Date(notification.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClearNotification(notification.id);
                      }}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <span className="sr-only">Dismiss</span>
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                  No notifications
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navigation; 