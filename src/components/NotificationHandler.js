import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ref, update, onValue } from 'firebase/database';
import { rtdb } from '../firebase/config';
import { requestNotificationPermission, onMessageListener, initializeMessaging } from '../firebase/config';

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

  return null;
};

export default NotificationHandler; 