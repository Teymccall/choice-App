import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { 
  getFirestore, 
  enableNetwork,
  disableNetwork,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getStorage, connectStorageEmulator } from "firebase/storage";

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
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
    sizeBytes: 50000000 // 50 MB
  }),
  experimentalAutoDetectLongPolling: true, // Automatically detect the best polling method
});

// Initialize Realtime Database
const rtdb = getDatabase(app);

const storage = getStorage(app);

// Network state management functions
const enableFirestoreNetwork = async () => {
  try {
    await enableNetwork(db);
    console.log('Firestore network enabled');
  } catch (error) {
    console.error('Error enabling Firestore network:', error);
    // Retry after a delay
    setTimeout(() => enableFirestoreNetwork(), 5000);
  }
};

const disableFirestoreNetwork = async () => {
  try {
    await disableNetwork(db);
    console.log('Firestore network disabled');
  } catch (error) {
    console.error('Error disabling Firestore network:', error);
  }
};

// Constants for retry logic
const TIMEOUT = 15000; // 15 seconds
const MAX_RETRY_ATTEMPTS = 5;
const INITIAL_RETRY_DELAY = 1000; // 1 second

// Export configured instances and utilities
export { 
  app, 
  analytics, 
  auth, 
  db, 
  rtdb,
  storage,
  enableFirestoreNetwork,
  disableFirestoreNetwork,
  TIMEOUT,
  MAX_RETRY_ATTEMPTS,
  INITIAL_RETRY_DELAY
}; 