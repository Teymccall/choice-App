import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ref, update, onValue } from 'firebase/database';
import { rtdb } from '../firebase/config';
import { requestNotificationPermission, onMessageListener, initializeMessaging } from '../firebase/config';
import { toast } from 'react-hot-toast';

const NotificationHandler = () => {
  const { user } = useAuth();
  const [isSetup, setIsSetup] = useState(false);

  useEffect(() => {
    if (!user || isSetup) return;

    const setupNotifications = async () => {
      try {
        // Step 1: Check if the browser supports notifications
        if (!('Notification' in window)) {
          console.log('This browser does not support notifications');
          return;
        }

        // Step 2: Wait for service worker registration
        const swRegistration = await navigator.serviceWorker.ready;
        console.log('Service Worker is ready:', swRegistration);

        // Step 3: Initialize messaging
        console.log('Initializing messaging...');
        const isInitialized = await initializeMessaging();
        if (!isInitialized) {
          console.log('Messaging not supported in this environment - skipping setup');
          return;
        }

        // Step 4: Request permission and get token only if permission is granted
        console.log('Requesting notification permission...');
        try {
          const token = await requestNotificationPermission();
          if (!token) {
            console.log('No FCM token available');
            return;
          }
          console.log('FCM token obtained successfully');
        } catch (error) {
          console.error('Error getting FCM token:', error);
          if (error.code === 'messaging/token-subscribe-failed') {
            console.error('Token subscription failed. Please check Firebase configuration and credentials.');
          }
          return;
        }

        // Step 5: Set up message listener for foreground messages
        onMessageListener()
          .then(payload => {
            console.log('Received foreground message:', payload);
            // Show notification even when app is in foreground
            if (Notification.permission === 'granted') {
              new Notification(payload.notification?.title || 'New Message', {
                body: payload.notification?.body || '',
                icon: '/choice.png',
                badge: '/choice.png',
                tag: payload.data?.type || 'default',
                data: payload.data
              });
            }
          })
          .catch(err => console.error('Error setting up message listener:', err));

        // Step 6: Mark setup as complete
        setIsSetup(true);
        console.log('Notification setup completed successfully');

      } catch (error) {
        console.error('Error in notification setup:', error);
        // Don't throw the error, just log it
      }
    };

    setupNotifications();
  }, [user, isSetup]);

  useEffect(() => {
    if (!user?.uid) return;

    // Listen for connection requests
    const requestsRef = ref(rtdb, `connectionRequests/${user.uid}`);
    const unsubscribeRequests = onValue(requestsRef, (snapshot) => {
      const requests = snapshot.val();
      if (!requests) return;

      // Get new requests (ones that haven't been shown yet)
      Object.entries(requests).forEach(([senderId, request]) => {
        if (!request.notificationShown) {
          // Show toast notification
          toast.custom((t) => (
            <div
              className={`${
                t.visible ? 'animate-enter' : 'animate-leave'
              } max-w-md w-full bg-white dark:bg-[#2a3942] shadow-lg rounded-lg pointer-events-auto flex items-center`}
            >
              <div className="flex-1 w-0 p-4">
                <div className="flex items-start">
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      New Connection Request
                    </p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
                      {request.senderName || 'Someone'} wants to connect with you
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex border-l border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    // Handle view action - you can navigate to requests page or show details
                    toast.dismiss(t.id);
                    // Update notification as shown
                    update(ref(rtdb, `connectionRequests/${user.uid}/${senderId}`), {
                      notificationShown: true
                    });
                  }}
                  className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-[#00a884] hover:text-[#06cf9c] focus:outline-none"
                >
                  View
                </button>
              </div>
            </div>
          ), {
            duration: 5000,
            position: 'top-center',
          });
        }
      });
    });

    return () => {
      unsubscribeRequests();
    };
  }, [user?.uid]);

  return null;
};

export default NotificationHandler; 