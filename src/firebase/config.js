import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { 
  getFirestore, 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

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

// Initialize Firestore with settings
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
    sizeBytes: 50000000 // 50 MB
  }),
  experimentalAutoDetectLongPolling: true,
});

// Initialize Realtime Database
const rtdb = getDatabase(app);

// Initialize Storage
const storage = getStorage(app);

// Constants
const TIMEOUT = 30000;
const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY = 1000;

export { 
  auth, 
  db, 
  rtdb,
  storage,
  TIMEOUT,
  MAX_RETRY_ATTEMPTS,
  INITIAL_RETRY_DELAY
}; 