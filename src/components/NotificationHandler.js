import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ref, update, onValue } from 'firebase/database';
import { rtdb } from '../firebase/config';
import { requestNotificationPermission, onMessageListener, initializeMessaging } from '../firebase/config';

const NotificationHandler = () => {
  const { user } = useAuth();
  const [notification, setNotification] = useState(null);
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

        // Step 2: Initialize messaging
        console.log('Step 1: Initializing messaging...');
        const isInitialized = await initializeMessaging();
        if (!isInitialized) {
          console.log('Messaging not supported in this environment - skipping setup');
          return;
        }

        // Step 3: Request permission and get token only if permission is granted
        console.log('Step 2: Requesting notification permission...');
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.log('Notification permission not granted');
          return;
        }

        // Step 4: Get FCM token
        console.log('Step 3: Getting FCM token...');
        const token = await requestNotificationPermission();
        if (!token) {
          console.log('No FCM token available');
          return;
        }

        // Step 5: Store token in database
        console.log('Step 4: Storing token in database...');
        const userRef = ref(rtdb, `users/${user.uid}/fcmTokens/${token}`);
        await update(userRef, {
          token,
          lastUpdated: Date.now(),
          device: navigator.userAgent,
          platform: navigator.platform
        });

        // Step 6: Verify token storage
        const tokenRef = ref(rtdb, `users/${user.uid}/fcmTokens`);
        const unsubscribe = onValue(tokenRef, (snapshot) => {
          const tokens = snapshot.val();
          if (tokens && tokens[token]) {
            console.log('Token successfully stored in database');
            setIsSetup(true);

            // Send test notification only if we haven't set up yet
            if (!isSetup && Notification.permission === 'granted') {
              new Notification('Notifications Enabled', {
                body: 'You will now receive notifications from Choice App',
                icon: '/logo192.png'
              });
            }
          }
        });

        // Cleanup subscription
        return () => unsubscribe();
      } catch (error) {
        console.error('Error in notification setup:', error);
        // Don't throw the error, just log it
      }
    };

    setupNotifications();
  }, [user, isSetup]);

  useEffect(() => {
    if (notification) {
      console.log('New notification state:', notification);
    }
  }, [notification]);

  useEffect(() => {
    console.log('Notification setup status:', isSetup ? 'Complete' : 'Pending/Failed');
  }, [isSetup]);

  return null;
};

export default NotificationHandler; 