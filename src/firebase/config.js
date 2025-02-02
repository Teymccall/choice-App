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

// Function to request notification permission and get FCM token
const requestNotificationPermission = async () => {
  try {
    console.log('Checking if messaging is initialized...');
    const isInitialized = await initializeMessaging();
    if (!isInitialized) {
      console.error('Messaging not initialized, cannot request permission');
      return null;
    }

    console.log('Requesting notification permission from browser...');
    const permission = await Notification.requestPermission();
    console.log('Browser notification permission:', permission);
    
    if (permission !== 'granted') {
      console.log('Notification permission denied by user');
      return null;
    }

    console.log('Permission granted, getting FCM token...');
    // Get FCM token with proper vapidKey
    const token = await getToken(messaging, {
      vapidKey: "BPYfFKEflrYoH3jNvhQOGC5RKzpYuYHgzUoiV9D4Q-hWGz7gjV_AgRdpG_MgKFBJxQcYHXp-9Tko-W_Y5uX3Yl8"
    }).catch(error => {
      console.error('Error getting FCM token:', error);
      if (error.code === 'messaging/failed-service-worker-registration') {
        console.error('Service Worker registration failed. Make sure you have a valid service worker file.');
      }
      if (error.code === 'messaging/no-sw-in-reg') {
        console.error('No service worker found in registration.');
      }
      throw error;
    });

    if (token) {
      console.log('FCM Token successfully generated');
      return token;
    } else {
      console.error('FCM Token generation failed - token is null');
      return null;
    }
  } catch (error) {
    console.error('Error in requestNotificationPermission:', error);
    if (error.code === 'messaging/permission-blocked') {
      console.error('Notifications are blocked by the browser');
    } else if (error.code === 'messaging/unsupported-browser') {
      console.error('Browser does not support push notifications');
    }
    return null;
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