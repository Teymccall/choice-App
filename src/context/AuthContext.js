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
  enableIndexedDbPersistence,
  disableNetwork,
  enableNetwork,
  waitForPendingWrites,
  CACHE_SIZE_UNLIMITED
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

// Add connection management functions
const initializeFirestore = async () => {
  try {
    // Enable offline persistence with unlimited cache
    await enableIndexedDbPersistence(db, {
      cacheSizeBytes: CACHE_SIZE_UNLIMITED
    }).catch((err) => {
      if (err.code === 'failed-precondition') {
        // Multiple tabs open, persistence can only be enabled in one tab at a time
        console.warn('Persistence disabled: multiple tabs open');
      } else if (err.code === 'unimplemented') {
        // The current browser doesn't support persistence
        console.warn('Persistence not supported by browser');
      }
    });
  } catch (err) {
    console.error('Error initializing Firestore:', err);
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

  // Initialize Firestore when the app starts
  useEffect(() => {
    initializeFirestore();
  }, []);

  // Update online/offline handling
  useEffect(() => {
    const handleConnectionChange = async () => {
      try {
        if (navigator.onLine) {
          await enableNetwork(db);
          setIsOnline(true);
        } else {
          await disableNetwork(db);
          setIsOnline(false);
        }
      } catch (err) {
        console.error('Error handling connection change:', err);
      }
    };

    window.addEventListener('online', handleConnectionChange);
    window.addEventListener('offline', handleConnectionChange);

    // Initial check
    handleConnectionChange();

    return () => {
      window.removeEventListener('online', handleConnectionChange);
      window.removeEventListener('offline', handleConnectionChange);
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

  // Enhanced connection status management
  useEffect(() => {
    if (!user?.uid) return;

    let isSubscribed = true;
    const cleanupFunctions = [];

    const setupConnection = async () => {
      try {
        // Create references
        const userStatusRef = ref(rtdb, `status/${user.uid}`);
        const userConnectionRef = ref(rtdb, '.info/connected');
        const connectedRef = ref(rtdb, `connections/${user.uid}`);

        // Set up connection listener
        const handleConnection = async (snapshot) => {
          if (!isSubscribed) return;
          if (snapshot.val() !== true) return;

          try {
            // Set up disconnect handlers first
            await Promise.all([
              onDisconnect(connectedRef).set({
                status: 'disconnected',
                lastSeen: rtdbTimestamp(),
                partnerId: partner?.uid || null
              }),
              onDisconnect(userStatusRef).set({
                state: 'offline',
                last_changed: rtdbTimestamp()
              })
            ]);

            // Then set online status
            await Promise.all([
              set(connectedRef, {
                status: 'connected',
                lastSeen: rtdbTimestamp(),
                partnerId: partner?.uid || null
              }),
              set(userStatusRef, {
                state: 'online',
                last_changed: rtdbTimestamp()
              })
            ]);
          } catch (err) {
            console.error('Error setting up connection:', err);
          }
        };

        // Set up connection listener
        const unsubConnection = onValue(userConnectionRef, handleConnection);
        cleanupFunctions.push(unsubConnection);

        // Set up partner monitoring if we have a partner
        if (partner?.uid) {
          const partnerConnectionRef = ref(rtdb, `connections/${partner.uid}`);
          const partnerStatusRef = ref(rtdb, `status/${partner.uid}`);

          const handlePartnerConnection = async (snapshot) => {
            if (!isSubscribed) return;
            const connection = snapshot.val();

            if (!connection || connection.status === 'disconnected') {
              try {
                // Get fresh partner data
                const partnerDoc = await getDoc(doc(db, 'users', partner.uid));
                
                if (!partnerDoc.exists() || partnerDoc.data().partnerId !== user.uid) {
                  // Clean up Firestore first
                  const batch = writeBatch(db);
                  batch.update(doc(db, 'users', user.uid), { 
                    partnerId: null,
                    inviteCodes: [] 
                  });
                  if (partnerDoc.exists()) {
                    batch.update(doc(db, 'users', partner.uid), { 
                      partnerId: null,
                      inviteCodes: [] 
                    });
                  }
                  await batch.commit();

                  // Then clean up RTDB
                  await Promise.all([
                    remove(ref(rtdb, `connections/${user.uid}`)),
                    remove(ref(rtdb, `connections/${partner.uid}`)),
                    remove(ref(rtdb, `status/${user.uid}`)),
                    remove(ref(rtdb, `status/${partner.uid}`))
                  ]);

                  // Finally update local state
                  if (isSubscribed) {
                    setPartner(null);
                    setDisconnectMessage('Your partner has disconnected');
                  }
                }
              } catch (err) {
                console.error('Error handling partner disconnection:', err);
              }
            }
          };

          const unsubPartner = onValue(partnerConnectionRef, handlePartnerConnection);
          cleanupFunctions.push(unsubPartner);

          const handlePartnerStatus = (snapshot) => {
            if (!isSubscribed) return;
            const status = snapshot.val();
            if (status?.state === 'offline') {
              console.log('Partner is offline');
            }
          };

          const unsubPartnerStatus = onValue(partnerStatusRef, handlePartnerStatus);
          cleanupFunctions.push(unsubPartnerStatus);
        }
      } catch (err) {
        console.error('Error in connection setup:', err);
      }
    };

    setupConnection();

    // Cleanup function
    return () => {
      isSubscribed = false;
      
      // Clean up all listeners
      cleanupFunctions.forEach(fn => fn());
      
      // Set offline status
      if (user?.uid) {
        Promise.all([
          set(ref(rtdb, `connections/${user.uid}`), {
            status: 'disconnected',
            lastSeen: rtdbTimestamp(),
            partnerId: null
          }),
          set(ref(rtdb, `status/${user.uid}`), {
            state: 'offline',
            last_changed: rtdbTimestamp()
          })
        ]).catch(console.error);
      }
    };
  }, [user?.uid, partner?.uid]);

  // Add listener for incoming connections
  useEffect(() => {
    if (!user?.uid) return;

    // Listen for changes to my user document in Firestore
    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribe = onValue(ref(rtdb, `connections`), async (snapshot) => {
      const connections = snapshot.val();
      
      try {
        // Get the latest user data from Firestore
        const userDoc = await getDoc(userDocRef);
        const userData = userDoc.data();
        
        // If we have a partnerId in Firestore
        if (userData?.partnerId) {
          const partnerConnection = connections?.[userData.partnerId];
          
          // If partner is connected and we don't have partner data
          if (partnerConnection?.status === 'connected' && !partner) {
            // Fetch partner data
            const partnerDoc = await getDoc(doc(db, 'users', userData.partnerId));
            if (partnerDoc.exists()) {
              const partnerData = partnerDoc.data();
              if (partnerData.partnerId === user.uid) {
                setPartner(partnerData);
                setDisconnectMessage(null);
                
                // Ensure our connection is also set
                const myConnectionRef = ref(rtdb, `connections/${user.uid}`);
                await set(myConnectionRef, {
                  status: 'connected',
                  lastSeen: rtdbTimestamp(),
                  partnerId: userData.partnerId
                });
              }
            }
          }
        }
      } catch (err) {
        console.error('Error handling incoming connection:', err);
      }
    });

    return () => unsubscribe();
  }, [user?.uid]);

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

  // Update auth state change handler
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setIsLoading(false);
      
      if (user) {
        // Initialize data for new sign in
        await initializeUserData(user);
      } else {
        // Clear states when user signs out
        setPartner(null);
        setDisconnectMessage(null);
        setActiveInviteCode(null);
      }
    });

    return unsubscribe;
  }, []);

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

  // Update the connect function to handle Firestore state properly
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

      // Wait for any pending writes
      await waitForPendingWrites(db);

      // Query for users with matching invite code
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
        where('inviteCodes', 'array-contains', {
          code: inviteCode.toUpperCase(),
          used: false,
          expiresAt: where('>', Timestamp.now())
        })
      );

      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        throw new Error('Invalid or expired invite code. Please try again with a valid code.');
      }

      const partnerDoc = querySnapshot.docs[0];
      const partnerId = partnerDoc.id;

      if (partnerId === user.uid) {
        throw new Error('You cannot connect with yourself.');
      }

      // Wait for pending writes before starting batch
      await waitForPendingWrites(db);

      // Start a batch write
      const batch = writeBatch(db);

      // Update partner's document
      const partnerRef = doc(db, 'users', partnerId);
      batch.update(partnerRef, {
        partnerId: user.uid,
        'inviteCodes': arrayRemove(inviteCode)
      });

      // Update current user's document
      const userRef = doc(db, 'users', user.uid);
      batch.update(userRef, {
        partnerId: partnerId
      });

      // Commit the batch
      await batch.commit();

      // Update RTDB connection status
      const connectionRef = ref(rtdb, `connections/${user.uid}`);
      await set(connectionRef, {
        partnerId: partnerId,
        lastActive: rtdbTimestamp()
      });

      return partnerId;
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
      
      // Update with single code
      await updateDoc(userRef, {
        inviteCodes: [inviteCode]
      });

      setActiveInviteCode(inviteCode);
      return inviteCode;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Update the disconnect function to handle Firestore state properly
  const disconnectPartner = async () => {
    try {
      if (!user) {
        throw new Error('You must be logged in to disconnect.');
      }

      if (!partner?.uid) {
        throw new Error('You are not currently connected with a partner.');
      }

      // Wait for any pending writes to complete
      await waitForPendingWrites(db);

      // First clean up RTDB connections
      const userConnectionRef = ref(rtdb, `connections/${user.uid}`);
      const partnerConnectionRef = ref(rtdb, `connections/${partner.uid}`);
      
      await Promise.all([
        remove(userConnectionRef),
        remove(partnerConnectionRef)
      ]);

      // Then update Firestore documents
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

      // Wait for pending writes before committing
      await waitForPendingWrites(db);
      await batch.commit();

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