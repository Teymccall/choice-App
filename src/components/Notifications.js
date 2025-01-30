import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  BellIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  XMarkIcon,
  UserPlusIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import { ref, onValue, remove, update } from 'firebase/database';
import { rtdb } from '../firebase/config';
import { useNavigate } from 'react-router-dom';

const NotificationTypes = {
  PARTNER_REQUEST: 'partner_request',
  TOPIC_RESPONSE: 'topic_response',
  CHAT_MESSAGE: 'chat_message',
  SYSTEM: 'system',
};

const Notifications = () => {
  const { user, partner } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user?.uid) return;

    const notificationsRef = ref(rtdb, `notifications/${user.uid}`);
    
    const unsubscribe = onValue(notificationsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setNotifications([]);
        return;
      }

      const notificationsList = Object.entries(data).map(([id, notification]) => ({
        id,
        ...notification,
      })).sort((a, b) => b.timestamp - a.timestamp);

      setNotifications(notificationsList);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Add new effect to clear notifications when panel is opened
  useEffect(() => {
    if (showNotifications && user?.uid) {
      // Mark all notifications as read in local storage
      localStorage.setItem(`lastChecked_notifications_${user.uid}`, Date.now().toString());
    }
  }, [showNotifications, user?.uid]);

  const handleDismiss = async (notificationId) => {
    if (!user?.uid) return;
    
    try {
      const notificationRef = ref(rtdb, `notifications/${user.uid}/${notificationId}`);
      await remove(notificationRef);
    } catch (error) {
      console.error('Error dismissing notification:', error);
    }
  };

  // Add function to clear all notifications
  const handleClearAll = async () => {
    if (!user?.uid) return;
    try {
      const notificationsRef = ref(rtdb, `notifications/${user.uid}`);
      await remove(notificationsRef);
      setShowNotifications(false);
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };

  const handleNotificationClick = async (notification) => {
    if (notification.type === 'chat_message') {
      // Store the topic ID to open the chat when navigating
      sessionStorage.setItem('openChatTopicId', notification.topicId);
      
      // If we're already on the topics page, dispatch an event to open the chat
      if (window.location.pathname === '/topics') {
        window.dispatchEvent(new CustomEvent('openTopicChat', {
          detail: { topicId: notification.topicId }
        }));
      } else {
        navigate('/topics');
      }
    }
    
    // Clear this notification
    if (handleDismiss) {
      handleDismiss(notification.id);
    }
  };

  const getNotificationContent = (notification) => {
    switch (notification.type) {
      case NotificationTypes.PARTNER_REQUEST:
        return {
          icon: <UserPlusIcon className="h-5 w-5 text-blue-500" />,
          title: 'Partner Request',
          message: `${notification.senderName} wants to connect with you`,
          className: 'bg-blue-50',
        };
      case NotificationTypes.TOPIC_RESPONSE:
        return {
          icon: <ChatBubbleLeftRightIcon className="h-5 w-5 text-green-500" />,
          title: 'Topic Response',
          message: `${notification.senderName} responded to "${notification.topicTitle}"`,
          className: 'bg-green-50',
        };
      case NotificationTypes.CHAT_MESSAGE:
        return {
          icon: <ChatBubbleLeftRightIcon className="h-5 w-5 text-primary-500" />,
          title: 'New Message',
          message: `${notification.senderName} sent a message in "${notification.topicTitle}": "${notification.message.length > 30 ? notification.message.substring(0, 30) + '...' : notification.message}"`,
          className: 'bg-primary-50',
          action: () => {
            const topicId = notification.topicId;
            if (topicId) {
              // Store the topicId in sessionStorage so it persists through navigation
              sessionStorage.setItem('openTopicChatId', topicId);
              
              // If already on topics page, dispatch event directly
              if (window.location.pathname === '/topics') {
                window.dispatchEvent(new CustomEvent('openTopicChat', { 
                  detail: { topicId } 
                }));
              } else {
                // Navigate to topics page - the Topics component will handle opening the chat
                window.location.href = '/topics';
              }
            }
          }
        };
      case NotificationTypes.SYSTEM:
        return {
          icon: <ExclamationCircleIcon className="h-5 w-5 text-yellow-500" />,
          title: 'System Notification',
          message: notification.message,
          className: 'bg-yellow-50',
        };
      default:
        return {
          icon: <BellIcon className="h-5 w-5 text-gray-500" />,
          title: 'Notification',
          message: notification.message,
          className: 'bg-gray-50',
        };
    }
  };

  return (
    <div className="relative">
      {/* Notification Bell */}
      <button
        onClick={() => setShowNotifications(!showNotifications)}
        className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors duration-200"
      >
        <BellIcon className="h-6 w-6" />
        {notifications.length > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full">
            {notifications.length}
          </span>
        )}
      </button>

      {/* Notifications Panel */}
      {showNotifications && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg overflow-hidden z-50 animate-slide-down">
          <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">Notifications</h3>
            {notifications.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-sm text-red-600 hover:text-red-800 font-medium"
              >
                Clear All
              </button>
            )}
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {notifications.length > 0 ? (
              notifications.map((notification) => {
                const content = getNotificationContent(notification);
                return (
                  <div
                    key={notification.id}
                    className={`p-4 border-b border-gray-200 ${content.className} animate-slide-up ${
                      content.action ? 'cursor-pointer hover:bg-opacity-75' : ''
                    }`}
                    onClick={() => {
                      if (content.action) {
                        content.action();
                        handleDismiss(notification.id);
                        setShowNotifications(false);
                      }
                    }}
                  >
                    <div className="flex items-start">
                      <div className="flex-shrink-0">{content.icon}</div>
                      <div className="ml-3 w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900">{content.title}</p>
                        <p className="mt-1 text-sm text-gray-500">{content.message}</p>
                      </div>
                      <div className="ml-4 flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDismiss(notification.id);
                          }}
                          className="inline-flex text-gray-400 hover:text-gray-500"
                        >
                          <XMarkIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-center text-gray-500">
                No notifications
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Notifications; 