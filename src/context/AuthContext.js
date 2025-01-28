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
} from 'firebase/firestore';
import { ref, onValue, set, off, get } from 'firebase/database';
import { 
  auth, 
  db,
  rtdb,
  TIMEOUT, 
  MAX_RETRY_ATTEMPTS, 
  INITIAL_RETRY_DELAY,
  enableFirestoreNetwork,
  disableFirestoreNetwork
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

  // Monitor online status and manage Firestore network state
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      enableFirestoreNetwork().catch(console.error);
    };

    const handleOffline = () => {
      setIsOnline(false);
      disableFirestoreNetwork().catch(console.error);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Enable network on initial load if online
    if (navigator.onLine) {
      enableFirestoreNetwork().catch(console.error);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    let unsubscribe = () => {};

    const setupAuthListener = async () => {
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        try {
          if (user) {
            // First set basic user data immediately
            const basicUserData = {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
            };
            setUser(basicUserData);

            if (isOnline) {
              try {
                const userDocRef = doc(db, 'users', user.uid);
                const userDoc = await retryOperation(async () => getDoc(userDocRef));
                
                if (userDoc.exists()) {
                  const userData = userDoc.data();
                  
                  // Check for valid invite codes
                  if (userData.inviteCodes?.length > 0) {
                    const now = Timestamp.now();
                    const validCodes = userData.inviteCodes.filter(
                      code => !code.used && code.expiresAt.toMillis() > now.toMillis()
                    );
                    
                    if (validCodes.length > 0) {
                      setActiveInviteCode(validCodes[validCodes.length - 1]);
                    } else {
                      setActiveInviteCode(null);
                    }
                  }
                  
                  setUser(prevUser => ({
                    ...prevUser,
                    ...userData,
                  }));

                  // Only try to fetch partner data if we have a partnerId
                  if (userData?.partnerId) {
                    try {
                      const partnerDoc = await retryOperation(async () => 
                        getDoc(doc(db, 'users', userData.partnerId))
                      );
                      if (partnerDoc.exists()) {
                        setPartner(partnerDoc.data());
                      }
                    } catch (partnerErr) {
                      console.error('Error fetching partner data:', partnerErr);
                    }
                  }
                } else {
                  // If user document doesn't exist, create one
                  const newUserData = {
                    ...basicUserData,
                    inviteCodes: [],
                    createdAt: Timestamp.now(),
                  };
                  
                  try {
                    await retryOperation(async () => 
                      setDoc(userDocRef, newUserData)
                    );
                    setUser(prevUser => ({
                      ...prevUser,
                      ...newUserData,
                    }));
                  } catch (createErr) {
                    console.error('Error creating user document:', createErr);
                  }
                }
              } catch (err) {
                console.error('Error fetching user data:', err);
                // Keep using basic user data if fetch fails
              }
            }
          } else {
            setUser(null);
            setPartner(null);
            setActiveInviteCode(null);
          }
        } catch (err) {
          console.error('Error in auth state change:', err);
          if (user) {
            setUser({
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
            });
          }
        } finally {
          setIsLoading(false);
        }
      });
    };

    setupAuthListener();
    return () => unsubscribe();
  }, [isOnline]);

  // Add real-time listener for partner status
  useEffect(() => {
    if (!user?.uid) return;

    const userStatusRef = ref(rtdb, `users/${user.uid}/partnerStatus`);
    onValue(userStatusRef, (snapshot) => {
      const status = snapshot.val();
      if (status === 'disconnected') {
        setPartner(null);
        setDisconnectMessage('Your partner has disconnected');
        // Clean up Firestore
        const userRef = doc(db, 'users', user.uid);
        updateDoc(userRef, { partnerId: null }).catch(console.error);
      }
    });

    return () => off(userStatusRef);
  }, [user?.uid]);

  const signup = async (email, password, displayName) => {
    try {
      if (!isOnline) {
        throw new Error('You are currently offline. Please check your internet connection.');
      }
      
      setError(null);
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      
      // Send verification email
      await user.sendEmailVerification({
        url: window.location.origin + '/login',
        handleCodeInApp: true,
      });
      
      // Update user profile
      await updateProfile(user, { displayName });
      
      // Create user document in Firestore
      const userData = {
        uid: user.uid,
        email,
        displayName,
        createdAt: Timestamp.now(),
        emailVerified: false,
        lastLogin: Timestamp.now()
      };

      await setDoc(doc(db, 'users', user.uid), userData);
      
      // Sign out user until they verify their email
      await signOut(auth);

      throw new Error(
        'Please check your email to verify your account before signing in. ' +
        'The verification link has been sent to your email address.'
      );
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const login = async (email, password) => {
    try {
      if (!isOnline) {
        throw new Error('You are currently offline. Please check your internet connection.');
      }
      
      setError(null);
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      
      // Check if email is verified
      if (!user.emailVerified) {
        // Send another verification email if needed
        await user.sendEmailVerification({
          url: window.location.origin + '/login',
          handleCodeInApp: true,
        });
        await signOut(auth);
        throw new Error(
          'Please verify your email address before signing in. ' +
          'A new verification link has been sent to your email.'
        );
      }
      
      // Update last login time
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        lastLogin: Timestamp.now(),
        emailVerified: true
      });
      
      return user;
    } catch (err) {
      setError(err.message);
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
      
      setError(null);
      const upperInviteCode = inviteCode.toUpperCase();
      
      const result = await retryOperation(async () => {
        const usersRef = collection(db, 'users');
        const q = query(usersRef);
        return getDocs(q);
      });
      
      const now = Timestamp.now();
      let partnerDoc = null;
      
      // Find the user with a matching valid invite code
      for (const doc of result.docs) {
        const userData = doc.data();
        if (userData.inviteCodes) {
          const validCode = userData.inviteCodes.find(
            code => code.code === upperInviteCode && 
                   !code.used && 
                   code.expiresAt.toMillis() > now.toMillis()
          );
          
          if (validCode) {
            partnerDoc = { id: doc.id, data: userData };
            break;
          }
        }
      }
      
      if (!partnerDoc) {
        throw new Error('Invalid or expired invite code');
      }
      
      const partnerId = partnerDoc.id;
      const partnerData = partnerDoc.data;
      
      if (partnerId === user.uid) {
        throw new Error('Cannot connect with yourself');
      }

      if (partnerData.partnerId) {
        throw new Error('This user is already connected with someone else');
      }

      await retryOperation(async () => {
        const batch = writeBatch(db);
        
        const partnerRef = doc(db, 'users', partnerId);
        batch.update(partnerRef, {
          partnerId: user.uid,
          inviteCodes: partnerData.inviteCodes.map(code => 
            code.code === upperInviteCode ? { ...code, used: true } : code
          )
        });

        const userRef = doc(db, 'users', user.uid);
        batch.update(userRef, { partnerId });

        return batch.commit();
      });

      setPartner(partnerData);
    } catch (err) {
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
      
      // First get current user data to clean up expired codes
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();
      
      // Initialize inviteCodes array if it doesn't exist
      const currentCodes = userData.inviteCodes || [];
      
      // Filter out expired codes
      const now = Timestamp.now();
      const validCodes = currentCodes.filter(
        code => !code.used && code.expiresAt.toMillis() > now.toMillis()
      );
      
      // Add the new code
      validCodes.push(inviteCode);

      // Update with clean list of codes
      await retryOperation(async () => 
        updateDoc(userRef, {
          inviteCodes: validCodes
        })
      );

      setActiveInviteCode(inviteCode);
      return inviteCode;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const disconnectPartner = async () => {
    try {
      if (!isOnline) {
        throw new Error('You are currently offline. Please check your internet connection.');
      }

      if (!user || !partner) {
        throw new Error('No active partnership to disconnect');
      }

      setError(null);

      // Update our own status first
      const userStatusRef = ref(rtdb, `users/${user.uid}/status`);
      await set(userStatusRef, {
        type: 'disconnect',
        partnerId: partner.uid,
        timestamp: Date.now()
      });

      // Update Firestore documents
      await retryOperation(async () => {
        const batch = writeBatch(db);
        
        // Update both users' documents
        const userRef = doc(db, 'users', user.uid);
        const partnerRef = doc(db, 'users', partner.uid);
        
        batch.update(userRef, { partnerId: null });
        batch.update(partnerRef, { partnerId: null });

        await batch.commit();
      });

      // Clear local state
      setPartner(null);
      setDisconnectMessage('You have disconnected from your partner');

      // Clean up our status
      await set(userStatusRef, null);
      
      console.log('Partnership successfully disconnected');
    } catch (err) {
      console.error('Error disconnecting partnership:', err);
      setError(err.message);
      throw err;
    }
  };

  // Update the partner status listener
  useEffect(() => {
    if (!user?.uid) return;

    const userStatusRef = ref(rtdb, `users/${user.uid}/status`);
    onValue(userStatusRef, async (snapshot) => {
      const status = snapshot.val();
      if (status?.type === 'disconnect' && status.partnerId === user.uid) {
        setPartner(null);
        setDisconnectMessage('Your partner has disconnected');
        // Clean up Firestore
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { partnerId: null }).catch(console.error);
        // Clean up RTDB status
        await set(userStatusRef, null).catch(console.error);
      }
    });

    return () => off(userStatusRef);
  }, [user?.uid]);

  const clearDisconnectMessage = () => {
    setDisconnectMessage(null);
  };

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Check if email is verified
      if (!user.emailVerified) {
        await signOut(auth);
        throw new Error('Please verify your email address before signing in.');
      }
      
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
      throw error;
    }
  };

  const value = {
    user,
    partner,
    activeInviteCode,
    setActiveInviteCode,
    login,
    logout,
    signup,
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