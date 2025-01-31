import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  getAuth,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  writeBatch,
  updateDoc,
  Timestamp,
  arrayUnion,
  arrayRemove,
  serverTimestamp as firestoreTimestamp,
  enableNetwork,
  disableNetwork,
  waitForPendingWrites,
  onSnapshot
} from 'firebase/firestore';
import { 
  ref, 
  onValue, 
  set, 
  get,
  update,
  serverTimestamp as rtdbTimestamp,
  onDisconnect,
  off,
  remove
} from 'firebase/database';
import { 
  auth, 
  db,
  rtdb,
  TIMEOUT, 
  MAX_RETRY_ATTEMPTS, 
  INITIAL_RETRY_DELAY,
} from '../firebase/config';

const AuthContext = createContext(null);

// Utility function for retrying operations with exponential backoff
const retryOperation = async (operation, retryCount = 0) => {
  try {
    return await Promise.race([
      operation(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Operation timed out')), TIMEOUT)
      )
    ]);
  } catch (error) {
    console.error(`Operation failed (attempt ${retryCount + 1}):`, error);
    
    if (error.code === 'permission-denied') {
      throw new Error('You do not have permission to perform this action');
    }
    
    if (retryCount < MAX_RETRY_ATTEMPTS) {
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryOperation(operation, retryCount + 1);
    }
    
    if (error.code === 'failed-precondition') {
      throw new Error('Please try again in a few moments');
    }
    
    throw error;
  }
};

let firestoreInitialized = false;
let networkEnabled = true;

const setNetworkEnabled = async (enabled) => {
  if (enabled === networkEnabled) return;
  
  try {
    if (enabled) {
      await enableNetwork(db);
    } else {
      await disableNetwork(db);
    }
    networkEnabled = enabled;
  } catch (err) {
    console.error('Error setting network state:', err);
  }
};

// Simplified write operation
const safeWrite = async (operation) => {
  try {
    return await operation();
  } catch (error) {
    console.error('Error in write operation:', error);
    throw error;
  }
};

// Add a cleanup function for Firestore state
const cleanupFirestore = async () => {
  try {
    // Disable network first to prevent new operations
    await disableNetwork(db);
    
    // Clear any pending writes
    await waitForPendingWrites(db);
    
    // Reset initialization flag
    firestoreInitialized = false;
    
    // Re-enable network
    await enableNetwork(db);
  } catch (err) {
    console.error('Error cleaning up Firestore:', err);
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [partner, setPartner] = useState(null);
  const [activeInviteCode, setActiveInviteCode] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [disconnectMessage, setDisconnectMessage] = useState(null);
  const auth = getAuth();
  const googleProvider = new GoogleAuthProvider();

  // Add refs to store cleanup functions
  const presenceRef = useRef(null);
  const userStatusRef = useRef(null);
  const listenerCleanups = useRef([]);

  // Setup database listeners
  const setupDatabaseListeners = async (user) => {
    try {
      // Set up presence system
      presenceRef.current = ref(rtdb, '.info/connected');
      userStatusRef.current = ref(rtdb, `connections/${user.uid}`);
      const userPresenceRef = ref(rtdb, `presence/${user.uid}`);

      const presenceUnsubscribe = onValue(presenceRef.current, async (snapshot) => {
        if (!snapshot.val()) return;

        try {
          // When we disconnect, update presence and connection status
          await onDisconnect(userStatusRef.current).remove();
          await onDisconnect(userPresenceRef).update({
            isOnline: false,
            lastOnline: rtdbTimestamp()
          });

          // Check if there's an existing partnership
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists() && userDoc.data().partnerId) {
            const partnerId = userDoc.data().partnerId;
            
            // Set current connection status
            await set(userStatusRef.current, {
              partnerId: partnerId,
              lastActive: rtdbTimestamp(),
              status: 'online'
            });

            // Set presence status
            await set(userPresenceRef, {
              isOnline: true,
              lastOnline: rtdbTimestamp()
            });
            
            // Get and set partner data
            const partnerDoc = await getDoc(doc(db, 'users', partnerId));
            if (partnerDoc.exists()) {
              setPartner(partnerDoc.data());

              // Listen for partner's presence
              const partnerPresenceRef = ref(rtdb, `presence/${partnerId}`);
              const partnerPresenceUnsubscribe = onValue(partnerPresenceRef, (presenceSnapshot) => {
                if (presenceSnapshot.exists()) {
                  const presenceData = presenceSnapshot.val();
                  setPartner(current => ({
                    ...current,
                    isOnline: presenceData.isOnline,
                    lastOnline: presenceData.lastOnline
                  }));
                }
              });

              // Listen for partner's connection status
              const partnerConnectionRef = ref(rtdb, `connections/${partnerId}`);
              const partnerConnectionUnsubscribe = onValue(partnerConnectionRef, async (connectionSnapshot) => {
                if (!connectionSnapshot.exists()) {
                  // Partner has disconnected - update both users
                  const batch = writeBatch(db);
                  
                  // Update current user's document
                  const currentUserRef = doc(db, 'users', user.uid);
                  batch.update(currentUserRef, {
                    partnerId: null,
                    partnerDisplayName: null,
                    lastUpdated: Timestamp.now()
                  });
                  
                  // Update partner's document
                  const partnerRef = doc(db, 'users', partnerId);
                  batch.update(partnerRef, {
                    partnerId: null,
                    partnerDisplayName: null,
                    lastUpdated: Timestamp.now()
                  });

                  try {
                    await batch.commit();
                    
                    // Remove current user's connection
                    await remove(userStatusRef.current);
                    
                    // Update presence
                    await update(userPresenceRef, {
                      isOnline: true,
                      lastOnline: rtdbTimestamp()
                    });

                    // Update local state
                    setPartner(null);
                    setDisconnectMessage(`${partnerDoc.data().displayName || 'Your partner'} has disconnected`);
                    
                    // Clean up listeners
                    await cleanupDatabaseListeners();
                  } catch (err) {
                    console.warn('Error handling partner disconnect:', err);
                  }
                }
              });

              listenerCleanups.current.push(partnerPresenceUnsubscribe);
              listenerCleanups.current.push(partnerConnectionUnsubscribe);
            }
          } else {
            // Set basic connection status if no partner
            await set(userStatusRef.current, {
              lastActive: rtdbTimestamp(),
              status: 'online'
            });

            // Set presence status
            await set(userPresenceRef, {
              isOnline: true,
              lastOnline: rtdbTimestamp()
            });
          }
        } catch (error) {
          console.error('Error in presence system:', error);
        }
      });

      listenerCleanups.current.push(presenceUnsubscribe);

      // Listen for partner updates in Firestore
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const userUnsubscribe = onSnapshot(userRef, async (snapshot) => {
          if (snapshot.exists()) {
            const userData = snapshot.data();
            if (!userData.partnerId) {
              // If partner ID is null, user has been disconnected
              setPartner(null);
              // Clean up RTDB connection
              await remove(userStatusRef.current);
            } else if (userData.partnerId && (!partner || partner.uid !== userData.partnerId)) {
              const partnerRef = doc(db, 'users', userData.partnerId);
              const partnerDoc = await getDoc(partnerRef);
              if (partnerDoc.exists()) {
                setPartner(partnerDoc.data());
              }
            }
          }
        });

        listenerCleanups.current.push(userUnsubscribe);
      }
    } catch (error) {
      console.error('Error setting up database listeners:', error);
    }
  };

  // Cleanup database listeners
  const cleanupDatabaseListeners = async () => {
    try {
      // Clean up all listeners
      listenerCleanups.current.forEach(cleanup => cleanup());
      listenerCleanups.current = [];

      // Clean up presence refs
      if (presenceRef.current) {
        off(presenceRef.current);
      }
      if (userStatusRef.current) {
        // Cancel any onDisconnect operations
        await onDisconnect(userStatusRef.current).cancel();
        // Remove the connection
        await remove(userStatusRef.current);
      }

      // Reset states
      setPartner(null);
      setActiveInviteCode(null);
      setDisconnectMessage(null);
    } catch (error) {
      console.error('Error cleaning up database listeners:', error);
    }
  };

  // Handle authentication errors
  const handleAuthError = (error) => {
    setError(null);
    switch (error.code) {
      case 'auth/user-not-found':
        setError('No account found with this email address');
        break;
      case 'auth/wrong-password':
        setError('Incorrect password');
        break;
      case 'auth/invalid-email':
        setError('Invalid email address');
        break;
      case 'auth/email-already-in-use':
        setError('An account already exists with this email address');
        break;
      case 'auth/weak-password':
        setError('Password should be at least 6 characters');
        break;
      case 'auth/network-request-failed':
        setError('Network error. Please check your internet connection');
        break;
      case 'auth/too-many-requests':
        setError('Too many attempts. Please try again later');
        break;
      case 'auth/popup-closed-by-user':
        setError('Sign-in cancelled. Please try again');
        break;
      default:
        setError(error.message || 'An error occurred during authentication');
    }
  };

  // Add persistence for auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsLoading(true);
      if (user) {
        try {
          // Get user data from Firestore
          const userRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUser({
              ...user,
              ...userData
            });

            // If user has a partner, fetch partner data
            if (userData.partnerId) {
              const partnerRef = doc(db, 'users', userData.partnerId);
              const partnerDoc = await getDoc(partnerRef);
              if (partnerDoc.exists()) {
                setPartner(partnerDoc.data());
              }
            }

            // Restore active invite code if exists
            if (userData.inviteCodes && Array.isArray(userData.inviteCodes)) {
              const now = new Date();
              const activeCode = userData.inviteCodes
                .filter(code => !code.used && code.expiresAt.toDate() > now)
                .sort((a, b) => b.createdAt - a.createdAt)[0];
              
              if (activeCode) {
                setActiveInviteCode({
                  code: activeCode.code,
                  expiresAt: activeCode.expiresAt
                });
              }
            }

            // Set up real-time presence
            await setupDatabaseListeners(user);
          } else {
            // If user doc doesn't exist, create it
            await setDoc(userRef, {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              createdAt: Timestamp.now(),
              lastLogin: Timestamp.now()
            });
            setUser(user);
          }
        } catch (error) {
          console.error('Error restoring user state:', error);
        }
      } else {
        // User is signed out
        setUser(null);
        setPartner(null);
        setActiveInviteCode(null);
        await cleanupDatabaseListeners();
      }
      setIsLoading(false);
    });

    // Set up online/offline detection
    const handleOnlineStatus = () => {
      setIsOnline(navigator.onLine);
      if (navigator.onLine) {
        enableNetwork(db);
      } else {
        disableNetwork(db);
      }
    };

    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
      cleanupDatabaseListeners();
    };
  }, []);

  // Initialize user data after sign up or sign in
  const initializeUserData = async (user) => {
    if (!user) return;
    
    try {
      // Clear any existing notifications for new users
      const notificationsRef = ref(rtdb, `notifications/${user.uid}`);
      await set(notificationsRef, null);

      // Clear any existing connections
      const connectionsRef = ref(rtdb, `connections/${user.uid}`);
      await set(connectionsRef, null);

      // Initialize user settings with defaults
      const userSettingsRef = ref(rtdb, `userSettings/${user.uid}`);
      const defaultSettings = {
        notifications: {
          newTopics: true,
          partnerResponses: true,
          suggestions: true,
        },
        theme: {
          preference: 'system'
        },
        privacy: {
          showProfile: true,
          anonymousNotes: false
        }
      };

      // Only set if not exists
      const snapshot = await get(userSettingsRef);
      if (!snapshot.exists()) {
        await set(userSettingsRef, defaultSettings);
      }

      // Clear partner state
      setPartner(null);
      setDisconnectMessage(null);
    } catch (error) {
      console.error('Error initializing user data:', error);
    }
  };

  const signIn = async (email, password) => {
    try {
      setError(null);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await initializeUserData(userCredential.user);
      
      // Show welcome alert after successful login
      const welcomeMessage = `
        <div class="space-y-2">
          <p class="font-medium">🎉 Welcome to Choice!</p>
          <p>This app is currently in development. Some features you should know about:</p>
          <ul class="list-disc pl-5 space-y-1">
            <li>Real-time chat and responses</li>
            <li>Image and media sharing</li>
            <li>Topic discussions with your partner</li>
          </ul>
          <p class="mt-2 text-sm">We're constantly improving the app. Thank you for being an early user!</p>
        </div>
      `;

      // Create and show the alert
      const alertDiv = document.createElement('div');
      alertDiv.className = 'fixed inset-0 flex items-center justify-center z-[100] bg-black/50';
      alertDiv.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 transform transition-all">
          <div class="p-6">
            ${welcomeMessage}
            <button class="mt-4 w-full bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors">
              Got it!
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(alertDiv);

      // Remove alert when clicked
      alertDiv.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON' || e.target === alertDiv) {
          alertDiv.classList.add('opacity-0');
          setTimeout(() => alertDiv.remove(), 150);
        }
      });

      return userCredential;
    } catch (err) {
      handleAuthError(err);
      throw err;
    }
  };

  const signUp = async (email, password, displayName) => {
    try {
      setError(null);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Set display name
      await updateProfile(userCredential.user, { displayName });
      
      // Initialize user data
      await initializeUserData(userCredential.user);
      
      return userCredential;
    } catch (err) {
      handleAuthError(err);
      throw err;
    }
  };

  const logout = async () => {
    try {
      if (!isOnline) {
        throw new Error('You are currently offline. Please check your internet connection.');
      }
      
      setError(null);
      await signOut(auth);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const connectPartner = async (inviteCode) => {
    try {
      if (!isOnline) {
        throw new Error('You are currently offline. Please check your internet connection.');
      }
      
      if (!user) {
        throw new Error('You must be logged in to connect with a partner.');
      }

      if (partner?.uid) {
        throw new Error('You are already connected with a partner. Please disconnect first.');
      }

      // Normalize the invite code
      const normalizedCode = inviteCode.trim().toUpperCase();

      // First find the user with this invite code
      const usersRef = collection(db, 'users');
      const querySnapshot = await getDocs(usersRef);
      let partnerDoc = null;
      
      // Add some buffer time to account for slight time differences
      const now = new Date();
      now.setMinutes(now.getMinutes() - 1); // 1 minute buffer
      
      // Search through all users to find matching invite code
      for (const doc of querySnapshot.docs) {
        const userData = doc.data();
        if (userData.inviteCodes && Array.isArray(userData.inviteCodes)) {
          const validCode = userData.inviteCodes.find(code => {
            const isMatch = code.code === normalizedCode;
            const isUnused = !code.used;
            const expiryDate = code.expiresAt.toDate();
            const isNotExpired = expiryDate > now;
            
            return isMatch && isUnused && isNotExpired;
          });
          
          if (validCode) {
            partnerDoc = { id: doc.id, ...userData };
            break;
          }
        }
      }

      if (!partnerDoc) {
        throw new Error('Invalid or expired invite code. Please try again with a valid code.');
      }

      if (partnerDoc.id === user.uid) {
        throw new Error('You cannot connect with yourself.');
      }

      // Use a batch write to update both users atomically
      const batch = writeBatch(db);

      // Update current user's document
      const userRef = doc(db, 'users', user.uid);
      batch.update(userRef, {
        partnerId: partnerDoc.id,
        partnerDisplayName: partnerDoc.displayName,
        lastUpdated: Timestamp.now()
      });

      // Update partner's document and mark invite code as used
      const partnerRef = doc(db, 'users', partnerDoc.id);
      const updatedInviteCodes = partnerDoc.inviteCodes.map(code => 
        code.code === normalizedCode 
          ? { 
              ...code, 
              used: true, 
              usedBy: user.uid, 
              usedAt: Timestamp.now() 
            }
          : code
      );

      batch.update(partnerRef, {
        inviteCodes: updatedInviteCodes,
        partnerId: user.uid,
        partnerDisplayName: user.displayName,
        lastUpdated: Timestamp.now()
      });

      // Commit the batch
      await batch.commit();

      // First update current user's connection status
      const userConnectionRef = ref(rtdb, `connections/${user.uid}`);
      await set(userConnectionRef, {
        partnerId: partnerDoc.id,
        lastActive: rtdbTimestamp(),
        status: 'online'
      });

      // Send a notification to partner about the connection
      try {
        const notificationRef = ref(rtdb, `notifications/${partnerDoc.id}`);
        await update(notificationRef, {
          [Date.now()]: {
            type: 'partner_connected',
            message: `${user.displayName || 'A new partner'} has connected with you`,
            timestamp: rtdbTimestamp()
          }
        });
      } catch (err) {
        console.warn('Error sending connection notification:', err);
      }

      // Set up database listeners for the new partnership
      await setupDatabaseListeners(user);

      // Get fresh partner data and update state
      const freshPartnerDoc = await getDoc(partnerRef);
      if (freshPartnerDoc.exists()) {
        setPartner({
          uid: partnerDoc.id,
          ...freshPartnerDoc.data()
        });
      }

      return partnerDoc.id;
    } catch (err) {
      console.error('Error connecting with partner:', err);
      setError(err.message);
      throw err;
    }
  };

  const generateInviteCode = async () => {
    try {
      if (!isOnline) {
        throw new Error('You are currently offline. Please check your internet connection.');
      }

      if (!user) {
        throw new Error('You must be logged in to generate an invite code.');
      }

      if (partner?.uid) {
        throw new Error('You are already connected with a partner. Please disconnect first to generate a new code.');
      }

      // Generate a more reliable code format
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const now = Timestamp.now();
      // Add 10 minutes instead of 5 to account for time differences
      const expiresAt = Timestamp.fromDate(new Date(Date.now() + (10 * 60 * 1000))); 

      // Get current user document
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        // Filter out expired and used codes
        const validCodes = (userData.inviteCodes || []).filter(existingCode => 
          !existingCode.used && existingCode.expiresAt.toDate() > now.toDate()
        );
        
        // Create the new invite code object
        const newInviteCode = {
          code,
          createdBy: user.uid,
          createdAt: now,
          expiresAt,
          used: false
        };
        
        // Update with cleaned up codes array plus new code
        await updateDoc(userRef, {
          inviteCodes: [...validCodes, newInviteCode]
        });

        // Wait for a moment to ensure the code is saved
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Set activeInviteCode with the Timestamp object directly
        setActiveInviteCode({
          code,
          expiresAt
        });
        
        setError(null);
        return newInviteCode;
      }
      
      throw new Error('User document not found');
    } catch (err) {
      console.error('Error generating invite code:', err);
      setError(err.message || 'Failed to generate invite code');
      throw err;
    }
  };

  const disconnectPartner = async () => {
    try {
      if (!user) {
        throw new Error('You must be logged in to disconnect.');
      }

      if (!partner?.uid) {
        throw new Error('You are not currently connected with a partner.');
      }

      const partnerId = partner.uid;
      const partnerName = partner.displayName || 'Your partner';

      // Immediately update local state to show disconnection
      setPartner(null);
      setActiveInviteCode(null);
      setError(null);
      setDisconnectMessage(`You have disconnected from ${partnerName}`);

      // First, update Firestore documents
      const batch = writeBatch(db);
      const userRef = doc(db, 'users', user.uid);
      const partnerRef = doc(db, 'users', partnerId);

      batch.update(userRef, {
        partnerId: null,
        partnerDisplayName: null,
        lastUpdated: Timestamp.now()
      });

      batch.update(partnerRef, {
        partnerId: null,
        partnerDisplayName: null,
        lastUpdated: Timestamp.now()
      });

      await batch.commit();

      // Then, handle RTDB updates one at a time
      try {
        // First remove user's connection
        const userConnectionRef = ref(rtdb, `connections/${user.uid}`);
        await remove(userConnectionRef);
      } catch (err) {
        console.warn('Error removing user connection:', err);
      }

      try {
        // Then try to remove partner's connection
        const partnerConnectionRef = ref(rtdb, `connections/${partnerId}`);
        await remove(partnerConnectionRef);
      } catch (err) {
        console.warn('Error removing partner connection:', err);
      }

      try {
        // Send notification to partner about disconnection
        const notificationRef = ref(rtdb, `notifications/${partnerId}`);
        await update(notificationRef, {
          [Date.now()]: {
            type: 'partner_disconnected',
            message: `${user.displayName || 'Your partner'} has disconnected`,
            timestamp: rtdbTimestamp()
          }
        });
      } catch (err) {
        console.warn('Error sending disconnect notification:', err);
      }

      // Clean up presence data
      try {
        const userPresenceRef = ref(rtdb, `presence/${user.uid}`);
        await update(userPresenceRef, {
          isOnline: true,
          lastOnline: rtdbTimestamp()
        });
      } catch (err) {
        console.warn('Error updating presence:', err);
      }

      // Force a cleanup of all listeners to ensure fresh state
      await cleanupDatabaseListeners();

    } catch (err) {
      console.error('Error disconnecting partner:', err);
      setError(err.message);
      throw err;
    }
  };

  const clearDisconnectMessage = () => {
    setDisconnectMessage(null);
  };

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Check if user exists in database
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        // Create new user profile in database
        const userData = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          createdAt: Timestamp.now(),
          emailVerified: true,
          lastLogin: Timestamp.now()
        };
        
        await setDoc(userRef, userData);

        // Show welcome alert for new users
        const welcomeMessage = `
          <div class="space-y-2">
            <p class="font-medium">👋 Welcome to Choice!</p>
            <p>Thanks for joining! Here's what you can do:</p>
            <ul class="list-disc pl-5 space-y-1">
              <li>Connect with your partner using invite codes</li>
              <li>Create and discuss topics together</li>
              <li>Share media and chat in real-time</li>
            </ul>
            <p class="mt-2 text-sm">The app is in development, and we're adding new features regularly!</p>
          </div>
        `;

        const alertDiv = document.createElement('div');
        alertDiv.className = 'fixed inset-0 flex items-center justify-center z-[100] bg-black/50';
        alertDiv.innerHTML = `
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 transform transition-all">
            <div class="p-6">
              ${welcomeMessage}
              <button class="mt-4 w-full bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors">
                Let's get started!
              </button>
            </div>
          </div>
        `;

        document.body.appendChild(alertDiv);

        alertDiv.addEventListener('click', (e) => {
          if (e.target.tagName === 'BUTTON' || e.target === alertDiv) {
            alertDiv.classList.add('opacity-0');
            setTimeout(() => alertDiv.remove(), 150);
          }
        });
      } else {
        // Update last login time
        await updateDoc(userRef, {
          lastLogin: Timestamp.now(),
          emailVerified: true
        });
      }
      
      return user;
    } catch (error) {
      if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in cancelled. Please try again.');
      }
      // Add more specific error handling
      if (error.code === 'auth/network-request-failed') {
        throw new Error('Network error. Please check your internet connection.');
      }
      if (error.code === 'auth/popup-blocked') {
        throw new Error('Pop-up blocked. Please allow pop-ups for this site.');
      }
      if (error.code === 'auth/cancelled-popup-request') {
        throw new Error('Sign-in cancelled. Please try again.');
      }
      throw error;
    }
  };

  const value = {
    user,
    partner,
    activeInviteCode,
    setActiveInviteCode,
    login: signIn,
    logout,
    signup: signUp,
    connectPartner,
    generateInviteCode,
    disconnectPartner,
    disconnectMessage,
    clearDisconnectMessage,
    isLoading,
    error,
    isOnline,
    signInWithGoogle,
  };

  // Only show loading for initial auth check
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 