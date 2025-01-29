import React, { createContext, useState, useContext, useEffect } from 'react';
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

  // Handle auth state changes
  useEffect(() => {
    let mounted = true;
    let authTimeout = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (!mounted) return;

        if (authTimeout) {
          clearTimeout(authTimeout);
        }

        authTimeout = setTimeout(async () => {
          if (!mounted) return;

          if (user) {
            setUser({
              uid: user.uid,
              email: user.email,
              displayName: user.displayName
            });
            
            if (navigator.onLine) {
              try {
                await initializeUserData(user);
              } catch (err) {
                console.error('Error initializing user data:', err);
              }
            }
          } else {
            setUser(null);
            setPartner(null);
            setActiveInviteCode(null);
          }
          setIsLoading(false);
        }, 1000);
      } catch (err) {
        console.error('Auth state change error:', err);
        if (mounted) {
          setIsLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      if (authTimeout) {
        clearTimeout(authTimeout);
      }
      unsubscribe();
    };
  }, []);

  // Handle online/offline state
  useEffect(() => {
    const handleOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);

    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
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

  // Update the connect function to use safeWrite
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

      // Get all users and filter manually since we can't do complex array queries
      const usersRef = collection(db, 'users');
      const querySnapshot = await getDocs(usersRef);
      const now = Timestamp.now();

      // Find user with matching invite code
      let validPartnerDoc = null;
      querySnapshot.forEach(doc => {
        const userData = doc.data();
        const matchingCode = userData.inviteCodes?.find(code => 
          code.code === inviteCode.toUpperCase() && 
          !code.used && 
          code.expiresAt?.toMillis() > now.toMillis()
        );
        
        if (matchingCode) {
          validPartnerDoc = doc;
        }
      });

      if (!validPartnerDoc) {
        throw new Error('Invalid or expired invite code. Please try again with a valid code.');
      }

      const partnerId = validPartnerDoc.id;

      if (partnerId === user.uid) {
        throw new Error('You cannot connect with yourself.');
      }

      // Use safeWrite for the batch operation
      await safeWrite(async () => {
        const batch = writeBatch(db);
        const partnerData = validPartnerDoc.data();
        const matchingCode = partnerData.inviteCodes.find(code => 
          code.code === inviteCode.toUpperCase()
        );

        // Update partner's document
        const partnerRef = doc(db, 'users', partnerId);
        batch.update(partnerRef, {
          partnerId: user.uid,
          inviteCodes: arrayRemove(matchingCode)
        });

        // Update current user's document
        const userRef = doc(db, 'users', user.uid);
        batch.update(userRef, {
          partnerId: partnerId
        });

        await batch.commit();

        // After successful connection, get fresh partner data and update state
        const freshPartnerDoc = await getDoc(partnerRef);
        if (freshPartnerDoc.exists()) {
          setPartner(freshPartnerDoc.data());
        }
      });

      // Update RTDB connection status
      const connectionRef = ref(rtdb, `connections/${user.uid}`);
      await set(connectionRef, {
        partnerId: partnerId,
        lastActive: rtdbTimestamp()
      });

      return partnerId;
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

      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const expiresAt = Timestamp.fromDate(new Date(Date.now() + 5 * 60 * 1000));
      const createdAt = Timestamp.now();

      const inviteCode = {
        code,
        createdAt,
        expiresAt,
        used: false
      };

      const userRef = doc(db, 'users', user.uid);
      
      await safeWrite(async () => {
        const userDoc = await getDoc(userRef);
        if (!userDoc.exists()) {
          throw new Error('User document not found');
        }

        await updateDoc(userRef, {
          inviteCodes: arrayUnion(inviteCode)
        });
      });

      setActiveInviteCode(inviteCode);
      setError(null);
      
      return inviteCode;
    } catch (err) {
      console.error('Error generating invite code:', err);
      setError(err.message || 'Failed to generate invite code');
      throw err;
    }
  };

  // Update the disconnect function to use safeWrite
  const disconnectPartner = async () => {
    try {
      if (!user) {
        throw new Error('You must be logged in to disconnect.');
      }

      if (!partner?.uid) {
        throw new Error('You are not currently connected with a partner.');
      }

      // First clean up RTDB connections
      const userConnectionRef = ref(rtdb, `connections/${user.uid}`);
      const partnerConnectionRef = ref(rtdb, `connections/${partner.uid}`);
      
      await Promise.all([
        remove(userConnectionRef),
        remove(partnerConnectionRef)
      ]);

      // Use safeWrite for the batch operation
      await safeWrite(async () => {
        const batch = writeBatch(db);
        
        const userRef = doc(db, 'users', user.uid);
        batch.update(userRef, {
          partnerId: null,
          inviteCodes: []
        });

        const partnerRef = doc(db, 'users', partner.uid);
        batch.update(partnerRef, {
          partnerId: null,
          inviteCodes: []
        });

        return batch.commit();
      });

      // Finally update local state
      setPartner(null);
      setActiveInviteCode(null);
      setError(null);
    } catch (err) {
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