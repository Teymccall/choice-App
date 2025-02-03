import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, browserLocalPersistence, setPersistence } from "firebase/auth";
import { 
  getFirestore, 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  CACHE_SIZE_UNLIMITED
} from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { ref, set, serverTimestamp } from 'firebase/database';

// Constants for authentication and retry logic
export const TIMEOUT = 30000; // 30 seconds
export const MAX_RETRY_ATTEMPTS = 3;
export const INITIAL_RETRY_DELAY = 1000; // 1 second

const firebaseConfig = {
  apiKey: "AIzaSyBl5cdGzFmb4xxz-3inNjUbRI9AKhsw7SE",
  authDomain: "choice-4496c.firebaseapp.com",
  databaseURL: "https://choice-4496c-default-rtdb.firebaseio.com",
  projectId: "choice-4496c",
  storageBucket: "choice-4496c.firebasestorage.app",
  messagingSenderId: "997107815311",
  appId: "1:997107815311:web:056bade42556f933faf1fa",
  measurementId: "G-FFDDRVPJRZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
const analytics = getAnalytics(app);
const auth = getAuth(app);
const rtdb = getDatabase(app);
const storage = getStorage(app);

// Initialize Firestore with settings
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
    sizeBytes: CACHE_SIZE_UNLIMITED
  }),
  experimentalAutoDetectLongPolling: true
});

// Enable persistence for authentication
setPersistence(auth, browserLocalPersistence);

// Initialize Messaging with proper checks
let messaging = null;

// Add VAPID key configuration
const VAPID_KEY = "BLwiJ4v1I6ICbjuVg1y03ASqrrKD8SEy8jS2KgbvzgY4GX6UwLZknHaNz50507OKQsKFJMwh_7nXwUACTmW5lig";

// Function to initialize messaging
const initializeMessaging = async () => {
  try {
    const isMessagingSupported = await isSupported();
    if (isMessagingSupported) {
      messaging = getMessaging(app);
      console.log('Firebase messaging initialized successfully');
      return true;
    } else {
      console.log('Firebase messaging is not supported in this environment');
      return false;
    }
  } catch (error) {
    console.error('Error initializing Firebase messaging:', error);
    return false;
  }
};

// Function to request notification permission
const requestNotificationPermission = async () => {
  try {
    console.log('Starting notification permission request process...');
    console.log('Browser/Device Info:', {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      vendor: navigator.vendor,
      isMobile: /Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    });
    
    // Step 1: Check if notifications are supported
    if (!('Notification' in window)) {
      console.error('This browser does not support notifications');
      return null;
    }

    // Step 2: Check messaging initialization
    console.log('Checking messaging initialization...');
    const isInitialized = await initializeMessaging();
    if (!isInitialized) {
      console.error('Messaging not initialized, cannot request permission');
      return null;
    }
    console.log('Messaging initialized successfully');

    // Step 3: Check authentication
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.error('No authenticated user found');
      return null;
    }
    console.log('User authenticated:', currentUser.uid);

    // Step 4: Request browser permission with fallback
    console.log('Requesting notification permission...');
    let permission;
    try {
      permission = await Notification.requestPermission();
    } catch (error) {
      // Fallback for older browsers
      permission = await new Promise((resolve) => {
        Notification.requestPermission(resolve);
      });
    }
    console.log('Notification permission:', permission);
    
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return null;
    }

    // Step 5: Get service worker registration with better error handling
    console.log('Getting service worker registration...');
    let registration;
    try {
      registration = await navigator.serviceWorker.ready;
      console.log('Service worker is ready');
    } catch (error) {
      console.error('Service worker registration failed:', error);
      // Try registering the service worker if it failed
      try {
        registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        console.log('Service worker registered successfully');
      } catch (regError) {
        console.error('Service worker registration failed:', regError);
        return null;
      }
    }

    // Step 6: Get FCM token with device-specific options
    console.log('Getting FCM token...');
    const tokenOptions = {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration
    };

    // Add additional options for mobile devices if needed
    if (/Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      console.log('Configuring for mobile device');
      // Mobile-specific configurations can be added here
    }

    const token = await getToken(messaging, tokenOptions);

    if (token) {
      console.log('FCM Token generated successfully');
      console.log('================== FCM TOKEN ==================');
      console.log(token);
      console.log('=============================================');
      
      // Store the token with device info
      const tokenRef = ref(rtdb, `users/${currentUser.uid}/fcmTokens/${token}`);
      await set(tokenRef, {
        token,
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        device: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          vendor: navigator.vendor,
          isMobile: /Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent),
          language: navigator.language,
          screenSize: {
            width: window.screen.width,
            height: window.screen.height
          }
        }
      });
      
      console.log('Token stored in database with device info');
      return token;
    } else {
      console.error('FCM Token generation failed - token is null');
      return null;
    }
  } catch (error) {
    console.error('Error in requestNotificationPermission:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack,
      browser: navigator.userAgent
    });
    throw error;
  }
};

// Function to handle incoming messages
const onMessageListener = () => {
  if (!messaging) {
    return Promise.reject(new Error('Messaging not initialized'));
  }
  
  return new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      console.log('Message received:', payload);
      resolve(payload);
    });
  });
};

export { 
  auth, 
  db, 
  rtdb,
  storage,
  requestNotificationPermission,
  onMessageListener,
  initializeMessaging
}; 