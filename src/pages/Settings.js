import React, { useState, useEffect } from 'react';
import { Switch } from '@headlessui/react';
import {
  Cog6ToothIcon,
  BellIcon,
  UserCircleIcon,
  ShieldCheckIcon,
  KeyIcon,
  EyeIcon,
  EyeSlashIcon,
  CheckCircleIcon,
  BookOpenIcon,
  ArrowRightIcon,
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
  TrashIcon,
  UserIcon,
  PaintBrushIcon,
  ArrowPathIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { ref, onValue, update, remove, get, serverTimestamp } from 'firebase/database';
import { rtdb } from '../firebase/config';
import { updatePassword, updateProfile } from 'firebase/auth';

const Settings = () => {
  const { user, partner, isOnline } = useAuth();
  const [notifications, setNotifications] = useState({
    newTopics: true,
    partnerResponses: true,
    suggestions: true,
  });
  const [privacy, setPrivacy] = useState({
    showProfile: true,
    anonymousNotes: true,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [password, setPassword] = useState({
    current: '',
    new: '',
    confirm: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState({
    chatMessages: true,
    topicResponses: true,
    systemNotifications: true
  });
  const [unreadCount, setUnreadCount] = useState(0);
  const [profile, setProfile] = useState({
    displayName: user?.displayName || '',
    email: user?.email || ''
  });
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [theme, setTheme] = useState('system');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme) return storedTheme === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [isSaving, setIsSaving] = useState(false);

  // Fetch notification settings and unread count
  useEffect(() => {
    if (!user?.uid) return;

    const settingsRef = ref(rtdb, `userSettings/${user.uid}/notifications`);
    const notificationsRef = ref(rtdb, `notifications/${user.uid}`);
    
    // Listen for notification settings
    const settingsUnsubscribe = onValue(settingsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setNotificationSettings(data);
      }
    });

    // Listen for unread notifications
    const notificationsUnsubscribe = onValue(notificationsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const count = Object.keys(data).length;
        setUnreadCount(count);
      } else {
        setUnreadCount(0);
      }
    });

    return () => {
      settingsUnsubscribe();
      notificationsUnsubscribe();
    };
  }, [user?.uid]);

  // Add useEffect for fetching privacy settings
  useEffect(() => {
    if (!user?.uid) return;

    const privacyRef = ref(rtdb, `userSettings/${user.uid}/privacy`);
    
    const privacyUnsubscribe = onValue(privacyRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setPrivacy(data);
      }
    });

    return () => {
      privacyUnsubscribe();
    };
  }, [user?.uid]);

  // Add useEffect for fetching profile data
  useEffect(() => {
    if (!user?.uid) return;

    const profileRef = ref(rtdb, `userSettings/${user.uid}/profile`);
    
    const profileUnsubscribe = onValue(profileRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setProfile(prev => ({
          ...prev,
          ...data
        }));
      }
    });

    return () => {
      profileUnsubscribe();
    };
  }, [user?.uid]);

  // Add theme effect to handle system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleSystemThemeChange = (e) => {
      if (theme === 'system') {
        document.documentElement.classList.toggle('dark', e.matches);
      }
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, [theme]);

  // Improved theme change handler
  const handleThemeChange = async (newTheme) => {
    if (!isOnline || !user?.uid) return;

    try {
      setIsSubmitting(true);
      const themeRef = ref(rtdb, `userSettings/${user.uid}/theme`);
      await update(themeRef, { preference: newTheme });
      
      // Update theme state
      setTheme(newTheme);
      
      // Apply theme changes
      if (newTheme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.toggle('dark', isDark);
        localStorage.removeItem('theme'); // Clear stored theme preference
      } else {
        document.documentElement.classList.toggle('dark', newTheme === 'dark');
        localStorage.setItem('theme', newTheme); // Store theme preference
      }
      
      setSuccessMessage('Theme updated successfully');
      setTimeout(() => setSuccessMessage(''), 2000);
    } catch (err) {
      console.error('Error updating theme:', err);
      setError('Failed to update theme');
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Enhanced theme initialization effect
  useEffect(() => {
    if (!user?.uid) return;

    // First try to get theme from Firebase
    const themeRef = ref(rtdb, `userSettings/${user.uid}/theme`);
    const unsubscribe = onValue(themeRef, (snapshot) => {
      const data = snapshot.val();
      if (data?.preference) {
        setTheme(data.preference);
        
        if (data.preference === 'system') {
          const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          document.documentElement.classList.toggle('dark', isDark);
          localStorage.removeItem('theme');
        } else {
          document.documentElement.classList.toggle('dark', data.preference === 'dark');
          localStorage.setItem('theme', data.preference);
        }
      } else {
        // If no Firebase preference, check localStorage
        const storedTheme = localStorage.getItem('theme');
        if (storedTheme) {
          setTheme(storedTheme);
          document.documentElement.classList.toggle('dark', storedTheme === 'dark');
        } else {
          // Default to system preference
          setTheme('system');
          const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          document.documentElement.classList.toggle('dark', isDark);
        }
      }
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Fetch user settings on component mount
  useEffect(() => {
    if (!user?.uid || !isOnline) return;

    const userSettingsRef = ref(rtdb, `userSettings/${user.uid}`);
    const unsubscribe = onValue(userSettingsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Update notifications state
        if (data.notifications) {
          setNotifications(data.notifications);
        }
        // Update dark mode state
        if (data.theme?.isDark !== undefined) {
          setIsDarkMode(data.theme.isDark);
          // Apply theme
          document.documentElement.classList.toggle('dark', data.theme.isDark);
          localStorage.setItem('theme', data.theme.isDark ? 'dark' : 'light');
        }
        // Update profile if exists
        if (data.profile) {
          setProfile(prev => ({
            ...prev,
            ...data.profile
          }));
        }
      }
    });

    return () => unsubscribe();
  }, [user?.uid, isOnline]);

  // Fetch theme preference from Firebase
  useEffect(() => {
    if (!user?.uid) return;

    const themeRef = ref(rtdb, `userSettings/${user.uid}/theme`);
    const unsubscribe = onValue(themeRef, (snapshot) => {
      const data = snapshot.val();
      if (data?.preference) {
        setIsDarkMode(data.preference === 'dark');
      }
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Handle dark mode changes
  const handleDarkModeChange = async () => {
    if (!isOnline || !user?.uid) {
      setError('You must be online to change settings');
      return;
    }

    try {
      setIsSubmitting(true);
      const newDarkMode = !isDarkMode;
      
      // Update Firebase with the new preference
      const themeRef = ref(rtdb, `userSettings/${user.uid}/theme`);
      await update(themeRef, { 
        preference: newDarkMode ? 'dark' : 'light',
        updatedAt: serverTimestamp()
      });
      
      // Local state will be updated by the Firebase listener
      setSuccessMessage('Theme updated successfully');
    } catch (err) {
      console.error('Error updating theme:', err);
      setError('Failed to update theme settings');
    } finally {
      setIsSubmitting(false);
      setTimeout(() => {
        setSuccessMessage('');
        setError('');
      }, 3000);
    }
  };

  // Handle notification changes
  const handleNotificationChange = async (key) => {
    if (!isOnline || !user?.uid) {
      setError('You must be online to change settings');
      return;
    }

    try {
      setIsSubmitting(true);
      const newNotifications = {
        ...notifications,
        [key]: !notifications[key]
      };
      
      // Update Firebase
      const notificationsRef = ref(rtdb, `userSettings/${user.uid}/notifications`);
      await update(notificationsRef, newNotifications);
      
      // Update local state
      setNotifications(newNotifications);
      
      setSuccessMessage('Notification settings updated');
    } catch (err) {
      console.error('Error updating notifications:', err);
      setError('Failed to update notification settings');
    } finally {
      setIsSubmitting(false);
      setTimeout(() => {
        setSuccessMessage('');
        setError('');
      }, 3000);
    }
  };

  // Handle profile update
  const handleProfileUpdate = async () => {
    if (!isOnline || !user?.uid) {
      setError('You must be online to update profile');
      return;
    }

    if (!profile.displayName.trim()) {
      setError('Display name cannot be empty');
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Update Firebase Auth profile
      await updateProfile(user, {
        displayName: profile.displayName.trim()
      });
      
      // Update Realtime Database
      const profileRef = ref(rtdb, `userSettings/${user.uid}/profile`);
      await update(profileRef, {
        displayName: profile.displayName.trim()
      });
      
      setSuccessMessage('Profile updated successfully');
    } catch (err) {
      console.error('Error updating profile:', err);
      setError('Failed to update profile');
    } finally {
      setIsSubmitting(false);
      setTimeout(() => {
        setSuccessMessage('');
        setError('');
      }, 3000);
    }
  };

  // Handle password change
  const handlePasswordChange = async () => {
    if (!isOnline || !user?.uid) {
      setError('You must be online to change password');
      return;
    }

    try {
      setIsSubmitting(true);
      // Show password change dialog (you can implement a modal or form for this)
      // For now, we'll just show an alert
      alert('Password change functionality will be implemented with a proper form');
      setSuccessMessage('Password change dialog shown');
    } catch (err) {
      console.error('Error with password change:', err);
      setError('Failed to process password change');
    } finally {
      setIsSubmitting(false);
      setTimeout(() => {
        setSuccessMessage('');
        setError('');
      }, 3000);
    }
  };

  // Handle settings reset
  const handleResetSettings = async () => {
    if (!isOnline || !user?.uid) {
      setError('You must be online to reset settings');
      return;
    }

    if (!window.confirm('Are you sure you want to reset all settings to default values?')) {
      return;
    }

    try {
      setIsSubmitting(true);
      
      const defaultSettings = {
        notifications: {
          newTopics: true,
          partnerResponses: true,
          suggestions: true,
        },
        theme: {
          isDark: window.matchMedia('(prefers-color-scheme: dark)').matches
        }
      };
      
      // Update Firebase
      const userSettingsRef = ref(rtdb, `userSettings/${user.uid}`);
      await update(userSettingsRef, defaultSettings);
      
      // Update local state
      setNotifications(defaultSettings.notifications);
      setIsDarkMode(defaultSettings.theme.isDark);
      
      // Apply theme
      document.documentElement.classList.toggle('dark', defaultSettings.theme.isDark);
      localStorage.setItem('theme', defaultSettings.theme.isDark ? 'dark' : 'light');
      
      setSuccessMessage('Settings reset to defaults');
    } catch (err) {
      console.error('Error resetting settings:', err);
      setError('Failed to reset settings');
    } finally {
      setIsSubmitting(false);
      setTimeout(() => {
        setSuccessMessage('');
        setError('');
      }, 3000);
    }
  };

  const manualSections = [
    {
      title: 'Getting Started',
      content: [
        'Create an account or sign in',
        'Generate your unique invite code',
        'Share your invite code with your partner',
        'Wait for your partner to connect using your code',
      ],
    },
    {
      title: 'Connecting with Partner',
      content: [
        'Each partner needs their own account',
        'One partner generates and shares their invite code',
        'The other partner enters this code to connect',
        'Once connected, you can start discussing topics',
      ],
    },
    {
      title: 'Managing Topics',
      content: [
        'Create new topics in different categories',
        'Respond to topics with Agree or Disagree',
        'View partner responses after both have answered',
        'Topics are organized by categories for easy navigation',
      ],
    },
    {
      title: 'Viewing Results',
      content: [
        'See completed topics and responses',
        'Compare your answers with your partner',
        'Get suggestions based on your responses',
        'Add anonymous notes for discussion',
      ],
    },
  ];

  const handleClearTopics = async () => {
    if (!user?.email || !partner?.email || !isOnline) {
      setError('You must be connected to clear topics');
      return;
    }

    // Ask for confirmation with more detailed warning
    if (!window.confirm('Are you sure you want to clear all topics and related data? This will remove all topics, progress, and statistics. This action cannot be undone.')) {
      return;
    }

    setIsClearing(true);
    setError(null);
    setSuccessMessage('');

    try {
      // Create a unique pairing ID using email addresses
      const getPairingId = (email1, email2) => {
        return [email1, email2].sort().join('_');
      };

      const currentPairingId = getPairingId(user.email, partner.email);

      // Get all topics
      const topicsRef = ref(rtdb, 'topics');
      const snapshot = await get(topicsRef);
      const topics = snapshot.val();

      // Get paths to clear
      const pathsToClear = [];

      // Add topics path
      if (topics) {
        const topicsToDelete = Object.entries(topics)
          .filter(([_, topic]) => {
            const topicPairingId = topic.initiatorEmail && topic.initialPartnerEmail ? 
              getPairingId(topic.initiatorEmail, topic.initialPartnerEmail) : null;
            return topicPairingId === currentPairingId;
          })
          .map(([id]) => id);

        // Add each topic path and its related data
        topicsToDelete.forEach(topicId => {
          pathsToClear.push(
            `topics/${topicId}`,
            `topicChats/${topicId}`,
            `topicProgress/${topicId}`,
            `responses/${topicId}`
          );
        });
      }

      // Add dashboard and progress paths
      pathsToClear.push(
        `userProgress/${user.uid}/pairs/${currentPairingId}`,
        `userProgress/${partner.uid}/pairs/${currentPairingId}`,
        `dashboardStats/${user.uid}/pairs/${currentPairingId}`,
        `dashboardStats/${partner.uid}/pairs/${currentPairingId}`,
        `pairProgress/${currentPairingId}`
      );

      // Delete all paths
      const deletePromises = pathsToClear.map(path => {
        const pathRef = ref(rtdb, path);
        return remove(pathRef);
      });

      await Promise.all(deletePromises);
      
      setSuccessMessage('All topics and related data have been cleared successfully');

      // Force reload dashboard data
      const dashboardEvent = new CustomEvent('refreshDashboard');
      window.dispatchEvent(dashboardEvent);

    } catch (err) {
      console.error('Error clearing data:', err);
      setError('Failed to clear data. Please try again.');
    } finally {
      setIsClearing(false);
    }
  };

  const handleSave = async (setting, value) => {
    setIsSaving(true);
    // Simulate saving
    await new Promise(resolve => setTimeout(resolve, 500));
    setIsSaving(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-16 pb-20 sm:pb-8">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-6">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="mt-2 text-base sm:text-lg text-gray-600 dark:text-gray-400">
            Customize your experience
          </p>
        </div>

        {/* Settings Cards */}
        <div className="space-y-4 sm:space-y-6">
          {/* Profile Settings */}
          <div className="bg-white dark:bg-gray-800 shadow p-4 sm:p-6 transform hover:scale-[1.01] hover:shadow-lg transition-all duration-200">
            <div className="flex items-center mb-4">
              <div className="inline-flex p-2 rounded-lg bg-primary-500">
                <UserIcon className="h-5 w-5 text-white" />
              </div>
              <h2 className="ml-3 text-lg font-medium text-gray-900 dark:text-white">Profile Settings</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">Display Name</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">This is how others will see you</p>
                </div>
                <input
                  type="text"
                  value={profile.displayName}
                  onChange={(e) => setProfile(prev => ({ ...prev, displayName: e.target.value }))}
                  className="w-full sm:w-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-600 dark:text-white"
                  placeholder={user?.displayName || 'Your name'}
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">Email</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Your email address</p>
                </div>
                <div className="text-sm text-gray-900 dark:text-white font-medium">
                  {user?.email}
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleProfileUpdate}
                disabled={isSubmitting || !isOnline}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transform transition-all duration-200 hover:scale-105"
              >
                {isSubmitting ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </div>

          {/* Appearance Settings */}
          <div className="bg-white dark:bg-gray-800 shadow p-4 sm:p-6 transform hover:scale-[1.01] hover:shadow-lg transition-all duration-200">
            <div className="flex items-center mb-4">
              <div className="inline-flex p-2 rounded-lg bg-yellow-500">
                <PaintBrushIcon className="h-5 w-5 text-white" />
              </div>
              <h2 className="ml-3 text-lg font-medium text-gray-900 dark:text-white">Appearance</h2>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">Dark Mode</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Toggle dark mode on or off</p>
                </div>
                <button
                  onClick={handleDarkModeChange}
                  disabled={isSubmitting}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                    isDarkMode ? 'bg-primary-600' : 'bg-gray-200'
                  } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className="sr-only">Toggle dark mode</span>
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out ${
                      isDarkMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Notification Settings */}
          <div className="bg-white dark:bg-gray-800 shadow p-4 sm:p-6 transform hover:scale-[1.01] hover:shadow-lg transition-all duration-200">
            <div className="flex items-center mb-4">
              <div className="inline-flex p-2 rounded-lg bg-blue-500">
                <BellIcon className="h-5 w-5 text-white" />
              </div>
              <h2 className="ml-3 text-lg font-medium text-gray-900 dark:text-white">Notifications</h2>
            </div>

            <div className="space-y-4">
              {Object.entries(notifications).map(([key, value]) => (
                <div key={key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                      {key.split(/(?=[A-Z])/).join(' ')}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {`Get notified about ${key.split(/(?=[A-Z])/).join(' ').toLowerCase()}`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleNotificationChange(key)}
                    disabled={isSubmitting}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                      value ? 'bg-primary-600' : 'bg-gray-200'
                    } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span className="sr-only">{`Toggle ${key}`}</span>
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out ${
                        value ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Privacy & Security */}
          <div className="bg-white dark:bg-gray-800 shadow p-4 sm:p-6 transform hover:scale-[1.01] hover:shadow-lg transition-all duration-200">
            <div className="flex items-center mb-4">
              <div className="inline-flex p-2 rounded-lg bg-green-500">
                <ShieldCheckIcon className="h-5 w-5 text-white" />
              </div>
              <h2 className="ml-3 text-lg font-medium text-gray-900 dark:text-white">Privacy & Security</h2>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">Change Password</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Update your password regularly for security</p>
                </div>
                <button
                  onClick={handlePasswordChange}
                  disabled={isSubmitting || !isOnline}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transform transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <KeyIcon className="h-4 w-4 mr-1.5" />
                  Change Password
                </button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">Reset Settings</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Restore all settings to default values</p>
                </div>
                <button
                  onClick={handleResetSettings}
                  disabled={isSubmitting || !isOnline}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-600 hover:bg-gray-50 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transform transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowPathIcon className="h-4 w-4 mr-1.5" />
                  Reset All
                </button>
              </div>
            </div>
          </div>

          {/* User Manual */}
          <div className="bg-white dark:bg-gray-800 shadow p-4 sm:p-6 transform hover:scale-[1.01] hover:shadow-lg transition-all duration-200">
            <div className="flex items-center mb-4">
              <div className="inline-flex p-2 rounded-lg bg-blue-500">
                <BookOpenIcon className="h-5 w-5 text-white" />
              </div>
              <h2 className="ml-3 text-lg font-medium text-gray-900 dark:text-white">User Manual</h2>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">View User Guide</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Learn how to use all features of the app</p>
                </div>
                <button
                  onClick={() => setShowManual(!showManual)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-600 hover:bg-gray-50 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transform transition-all duration-200 hover:scale-105"
                >
                  {showManual ? 'Hide Manual' : 'Show Manual'}
                </button>
              </div>

              {showManual && (
                <div className="space-y-6 animate-fade-in">
                  {manualSections.map((section, index) => (
                    <div 
                      key={section.title} 
                      className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg animate-slide-up"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <h3 className="text-base font-medium text-gray-900 dark:text-white mb-3">{section.title}</h3>
                      <ul className="space-y-2">
                        {section.content.map((item, itemIndex) => (
                          <li key={itemIndex} className="flex items-start text-sm text-gray-600 dark:text-gray-400">
                            <ArrowRightIcon className="h-5 w-5 text-primary-500 dark:text-primary-400 mr-2 flex-shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Clear Data */}
          <div className="bg-white dark:bg-gray-800 shadow p-4 sm:p-6 transform hover:scale-[1.01] hover:shadow-lg transition-all duration-200">
            <div className="flex items-center mb-4">
              <div className="inline-flex p-2 rounded-lg bg-red-500">
                <TrashIcon className="h-5 w-5 text-white" />
              </div>
              <h2 className="ml-3 text-lg font-medium text-gray-900 dark:text-white">Clear Data</h2>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">Clear All Topics</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Remove all topics and related data. This action cannot be undone.</p>
                </div>
                <button
                  onClick={handleClearTopics}
                  disabled={isClearing || !isOnline || !partner?.email}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transform transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <TrashIcon className="h-4 w-4 mr-1.5" />
                  {isClearing ? 'Clearing...' : 'Clear All'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Save Status */}
        {isSaving && (
          <div className="fixed bottom-4 right-4 bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-400 px-4 py-2 rounded-lg shadow-lg flex items-center">
            <CheckCircleIcon className="h-5 w-5 mr-1.5 animate-bounce-in" />
            Saving changes...
          </div>
        )}

        {/* Status Messages */}
        {(error || successMessage) && (
          <div className={`fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg flex items-center ${
            error ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400' : 
                   'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400'
          }`}>
            {error ? (
              <XCircleIcon className="h-5 w-5 mr-1.5" />
            ) : (
              <CheckCircleIcon className="h-5 w-5 mr-1.5" />
            )}
            {error || successMessage}
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings; 