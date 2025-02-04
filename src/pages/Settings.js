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
import { ref, onValue, update, remove, get, serverTimestamp, set } from 'firebase/database';
import { rtdb } from '../firebase/config';
import { updatePassword, updateProfile } from 'firebase/auth';
import { cookieManager } from '../utils/cookieManager';
import { auth } from '../firebase/config';
import { requestNotificationPermission } from '../firebase/config';
import ProfilePicture from '../components/ProfilePicture';

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
  const [isLoading, setIsLoading] = useState(true);
  const [notificationSettings, setNotificationSettings] = useState(() => {
    // Try to get from localStorage first
    const savedSettings = localStorage.getItem('notificationSettings');
    if (savedSettings) {
      return JSON.parse(savedSettings);
    }
    // Default values
    return {
      chatNotifications: true,
      topicNotifications: true,
      systemNotifications: true
    };
  });
  const [unreadCount, setUnreadCount] = useState(0);
  const [profile, setProfile] = useState({
    displayName: user?.displayName || '',
    email: user?.email || ''
  });
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme || 'system';
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return savedTheme === 'dark' || ((!savedTheme || savedTheme === 'system') && isSystemDark);
  });
  const [isSaving, setIsSaving] = useState(false);
  const [notificationBlocked, setNotificationBlocked] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState('default');

  // Add a check for valid authentication
  const checkAuthAndPermissions = () => {
    if (!user?.uid) {
      setError('You must be logged in to change settings');
      return false;
    }
    
    if (!isOnline) {
      setError('You must be online to save settings to the cloud');
      return false;
    }

    return true;
  };

  // Apply theme on initial mount and handle system changes
  useEffect(() => {
    const initializeTheme = () => {
      const savedTheme = localStorage.getItem('theme') || 'system';
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const shouldBeDark = savedTheme === 'dark' || (savedTheme === 'system' && isSystemDark);
      
      const root = document.documentElement;
      root.classList.remove('light', 'dark');
      
      if (savedTheme === 'system') {
        root.setAttribute('data-theme', 'system');
        root.classList.add(shouldBeDark ? 'dark' : 'light');
      } else {
        root.setAttribute('data-theme', savedTheme);
        root.classList.add(savedTheme);
      }
      
      setTheme(savedTheme);
      setIsDarkMode(shouldBeDark);
    };

    // Initialize theme immediately
    initializeTheme();

    // Set up system theme change listener
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = (e) => {
      if (theme === 'system') {
        const root = document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(e.matches ? 'dark' : 'light');
        setIsDarkMode(e.matches);
      }
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, []);

  const applyTheme = (themeName) => {
    try {
      const root = document.documentElement;
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const shouldBeDark = themeName === 'dark' || (themeName === 'system' && isSystemDark);

      // Remove existing theme classes
      root.classList.remove('light', 'dark');
      root.removeAttribute('data-theme');
      
      // Apply new theme
      if (themeName === 'system') {
        root.setAttribute('data-theme', 'system');
        root.classList.add(shouldBeDark ? 'dark' : 'light');
      } else {
        root.setAttribute('data-theme', themeName);
        root.classList.add(themeName);
      }

      // Store in localStorage
      localStorage.setItem('theme', themeName);
      localStorage.setItem('lastThemeUpdate', new Date().toISOString());
      
      // Update state
      setTheme(themeName);
      setIsDarkMode(shouldBeDark);
      
      return true;
    } catch (error) {
      console.error('Error applying theme:', error);
      return false;
    }
  };

  // Modified handleThemeChange
  const handleThemeChange = async (newTheme) => {
    try {
      setIsSubmitting(true);
      setError(null);
      
      // Apply theme locally first
      const root = document.documentElement;
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const shouldBeDark = newTheme === 'dark' || (newTheme === 'system' && isSystemDark);

      // Remove existing theme classes
      root.classList.remove('light', 'dark');
      root.removeAttribute('data-theme');
      
      // Apply new theme
      if (newTheme === 'system') {
        root.setAttribute('data-theme', 'system');
        root.classList.add(shouldBeDark ? 'dark' : 'light');
      } else {
        root.setAttribute('data-theme', newTheme);
        root.classList.add(newTheme);
      }

      // Store in both localStorage and cookies
      localStorage.setItem('theme', newTheme);
      cookieManager.saveTheme(newTheme);
      
      // Update state
      setTheme(newTheme);
      setIsDarkMode(shouldBeDark);

      // Try to update Firebase if authenticated
      if (checkAuthAndPermissions()) {
        try {
          const settingsRef = ref(rtdb, `userSettings/${user.uid}`);
          await update(settingsRef, {
            theme: {
              preference: newTheme,
              updatedAt: serverTimestamp(),
              localUpdate: new Date().toISOString()
            }
          });
        } catch (error) {
          console.warn('Firebase sync failed:', error);
        }
      }

      setSuccessMessage('Theme updated successfully');
    } catch (err) {
      console.error('Error updating theme:', err);
      setError('Theme update failed. Please try again.');
    } finally {
      setIsSubmitting(false);
      setTimeout(() => {
        setSuccessMessage('');
        setError(null);
      }, 3000);
    }
  };

  // Fetch notification settings and unread count
  useEffect(() => {
    if (!user?.uid) return;

    const settingsRef = ref(rtdb, `userSettings/${user.uid}/notifications`);
    const notificationsRef = ref(rtdb, `notifications/${user.uid}`);
    
    setIsLoading(true);
    
    // First get the current settings
    get(settingsRef).then((snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const newSettings = {
          chatNotifications: data.chatNotifications ?? true,
          topicNotifications: data.topicNotifications ?? true,
          systemNotifications: data.systemNotifications ?? true
        };
        setNotificationSettings(newSettings);
        // Save to localStorage
        localStorage.setItem('notificationSettings', JSON.stringify(newSettings));
      }
      setIsLoading(false);
    });
    
    // Then listen for changes
    const settingsUnsubscribe = onValue(settingsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const newSettings = {
          chatNotifications: data.chatNotifications ?? true,
          topicNotifications: data.topicNotifications ?? true,
          systemNotifications: data.systemNotifications ?? true
        };
        setNotificationSettings(newSettings);
        // Save to localStorage
        localStorage.setItem('notificationSettings', JSON.stringify(newSettings));
      }
    });

    const notificationsUnsubscribe = onValue(notificationsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const count = Object.values(data).filter(n => !n.read).length;
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

  // Fetch privacy settings
  useEffect(() => {
    if (!user?.uid) return;

    const privacyRef = ref(rtdb, `userSettings/${user.uid}/privacy`);
    
    const privacyUnsubscribe = onValue(privacyRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setPrivacy(data);
      }
    });

    return () => privacyUnsubscribe();
  }, [user?.uid]);

  // Fetch profile data
  useEffect(() => {
    if (!user?.uid) return;

    const profileRef = ref(rtdb, `userSettings/${user.uid}/profile`);
    
    const profileUnsubscribe = onValue(profileRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Only update if we're not in editing mode
        if (!isEditing) {
          setProfile(prev => ({
            ...prev,
            ...data,
            displayName: auth.currentUser?.displayName || data.displayName || '',
            email: auth.currentUser?.email || data.email || ''
          }));
        }
      }
    });

    return () => profileUnsubscribe();
  }, [user?.uid, auth.currentUser?.displayName, auth.currentUser?.email, isEditing]);

  // Check notification permission status
  const checkNotificationPermission = () => {
    if (!('Notification' in window)) {
      setNotificationStatus('unsupported');
      return false;
    }

    const permission = Notification.permission;
    setNotificationStatus(permission);
    setNotificationBlocked(permission === 'denied');
    return permission === 'granted';
  };

  // Handle notification toggle
  const handleNotificationToggle = async (setting, value) => {
    try {
      setIsSubmitting(true);
      setError(null);

      // Check if notifications are supported
      if (!('Notification' in window)) {
        setError('Notifications are not supported in your browser');
        return;
      }

      // Create a new settings object with all current values
      const newSettings = {
        ...notificationSettings,
        [setting]: value
      };

      // Update local state first for immediate feedback
      setNotificationSettings(newSettings);
      // Save to localStorage
      localStorage.setItem('notificationSettings', JSON.stringify(newSettings));

      // If permission is denied, show instructions to unblock
      if (Notification.permission === 'denied') {
        setError(
          'Notifications are blocked. To enable them, click the lock/info icon in your browser\'s address bar, then allow notifications.'
        );
        return;
      }

      // If permission not granted and trying to enable, request it
      if (value && Notification.permission === 'default') {
        try {
          const token = await requestNotificationPermission();
          if (!token) {
            // Revert local state if permission wasn't granted
            setNotificationSettings(prev => ({
              ...prev,
              [setting]: !value
            }));
            setError('Failed to enable notifications. Please try again.');
            return;
          }
        } catch (err) {
          console.error('Error requesting notification permission:', err);
          // Revert local state on error
          setNotificationSettings(prev => ({
            ...prev,
            [setting]: !value
          }));
          setError('Failed to enable notifications. Please check your browser settings.');
          return;
        }
      }

      // Try to update Firebase if online
      if (isOnline && user?.uid) {
        try {
          const settingsRef = ref(rtdb, `userSettings/${user.uid}/notifications`);
          // Update all notification settings at once
          await update(settingsRef, {
            chatNotifications: newSettings.chatNotifications,
            topicNotifications: newSettings.topicNotifications,
            systemNotifications: newSettings.systemNotifications,
            updatedAt: serverTimestamp()
          });
          
          // If enabling notifications, send a test notification
          if (value) {
            const testNotificationRef = ref(rtdb, `notifications/${user.uid}/test_${Date.now()}`);
            await set(testNotificationRef, {
              type: 'test',
              title: 'Test Notification',
              body: `${setting} notifications are now enabled`,
              timestamp: serverTimestamp(),
              data: {
                type: 'test',
                setting
              }
            });
          }
          
          setSuccessMessage('Notification settings updated');
        } catch (error) {
          console.warn('Failed to save notification settings to Firebase:', error);
          // Only show error if we're online but save failed
          if (isOnline) {
            setError('Failed to save settings to the server, but notifications are enabled locally');
          }
        }
      }
    } catch (err) {
      console.error('Error updating notification settings:', err);
      setError('Failed to update notification settings');
      // Revert local state on error
      setNotificationSettings(prev => ({
        ...prev,
        [setting]: !value
      }));
    } finally {
      setIsSubmitting(false);
      setTimeout(() => {
        setSuccessMessage('');
        setError(null);
      }, 3000);
    }
  };

  // Initialize notification permission check
  useEffect(() => {
    checkNotificationPermission();
  }, []);

  const handleProfileUpdate = async () => {
    if (!isOnline || !user?.uid) {
      setError('You must be online to update profile');
      return;
    }

    if (!profile.displayName?.trim()) {
      setError('Display name cannot be empty');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      
      const newDisplayName = profile.displayName.trim();
      
      // First update Firebase Auth profile
      await updateProfile(auth.currentUser, {
        displayName: newDisplayName
      });

      // Then update profile in database
      const profileRef = ref(rtdb, `userSettings/${user.uid}/profile`);
      await update(profileRef, {
        displayName: newDisplayName,
        email: user.email,
        updatedAt: serverTimestamp()
      });

      // Update user data in RTDB
      const userRef = ref(rtdb, `users/${user.uid}`);
      await update(userRef, {
        displayName: newDisplayName,
        updatedAt: serverTimestamp()
      });
      
      // Update local state
      setProfile(prev => ({
        ...prev,
        displayName: newDisplayName
      }));
      
      setSuccessMessage('Profile updated successfully');
      setIsEditing(false);
      setTimeout(() => setSuccessMessage(''), 2000);
    } catch (err) {
      console.error('Error updating profile:', err);
      if (err.code === 'PERMISSION_DENIED') {
        setError('Permission denied. Please check if you are logged in.');
      } else {
        setError('Failed to update profile. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!isOnline || !user?.uid) {
      setError('You must be online to change password');
      return;
    }

    if (password.new !== password.confirm) {
      setError('New passwords do not match');
      return;
    }

    try {
      setIsSubmitting(true);
      await updatePassword(user, password.new);
      
      setPassword({
        current: '',
        new: '',
        confirm: ''
      });
      
      setSuccessMessage('Password updated successfully');
      setTimeout(() => setSuccessMessage(''), 2000);
    } catch (err) {
      console.error('Error updating password:', err);
      setError('Failed to update password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrivacyChange = async (key) => {
    if (!isOnline || !user?.uid) {
      setError('You must be online to change settings');
      return;
    }

    try {
      setIsSubmitting(true);
      const newPrivacy = {
        ...privacy,
        [key]: !privacy[key]
      };

      const privacyRef = ref(rtdb, `userSettings/${user.uid}/privacy`);
      await update(privacyRef, newPrivacy);
      
      setPrivacy(newPrivacy);
      setSuccessMessage('Privacy settings updated');
      setTimeout(() => setSuccessMessage(''), 2000);
    } catch (err) {
      console.error('Error updating privacy settings:', err);
      setError('Failed to update privacy settings');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetSettings = async () => {
    if (!isOnline || !user?.uid) {
      setError('You must be online to reset settings');
      return;
    }

    try {
      setIsSubmitting(true);
      const defaultSettings = {
        notifications: {
          chatNotifications: true,
          topicNotifications: true,
          systemNotifications: true
        },
        privacy: {
          showProfile: true,
          anonymousNotes: false
        },
        theme: {
          preference: 'system',
          updatedAt: serverTimestamp()
        }
      };

      const settingsRef = ref(rtdb, `userSettings/${user.uid}`);
      await update(settingsRef, defaultSettings);
      
      setNotificationSettings(defaultSettings.notifications);
      setPrivacy(defaultSettings.privacy);
      handleThemeChange(defaultSettings.theme.preference);
      
      setSuccessMessage('Settings reset to defaults');
      setTimeout(() => setSuccessMessage(''), 2000);
    } catch (err) {
      console.error('Error resetting settings:', err);
      setError('Failed to reset settings');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearTopics = async () => {
    if (!isOnline || !user?.uid) {
      setError('You must be online to clear topics');
      return;
    }

    try {
      setIsClearing(true);

      // Get all topics where the user is involved
      const topicsRef = ref(rtdb, 'topics');
      const snapshot = await get(topicsRef);
      const topics = snapshot.val();

      if (!topics) {
        setSuccessMessage('No topics to clear');
        return;
      }
      
      // Find and remove topics where the user is either creator or partner
      const batch = {};
      Object.entries(topics).forEach(([topicId, topic]) => {
        if ((topic.createdBy === user.uid && topic.partnerId === partner?.uid) ||
            (topic.createdBy === partner?.uid && topic.partnerId === user.uid)) {
          batch[`topics/${topicId}`] = null;
          // Also clear associated chat messages
          batch[`topicChats/${topicId}`] = null;
        }
      });

      if (Object.keys(batch).length > 0) {
        await update(ref(rtdb), batch);
        setSuccessMessage('Topics cleared successfully');
      } else {
        setSuccessMessage('No topics to clear');
      }
      
      setTimeout(() => setSuccessMessage(''), 2000);
    } catch (err) {
      console.error('Error clearing topics:', err);
      setError('Failed to clear topics');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-8">
      {/* Settings sections */}
      <div className="space-y-6">
        {/* Profile Section */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <UserCircleIcon className="h-6 w-6" />
            Profile Settings
          </h2>
          <div className="mt-4 space-y-4">
            {/* Add Profile Picture */}
            <div className="flex justify-center">
              <ProfilePicture size="lg" editable={isEditing} />
            </div>
            
            <div>
              <label className="block text-sm font-medium">Display Name</label>
              <input
                type="text"
                value={profile.displayName}
                onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                disabled={!isEditing}
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Email</label>
              <input
                type="email"
                value={profile.email}
                disabled
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-gray-50"
              />
            </div>
            <div className="flex justify-end gap-2">
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                >
                  Edit Profile
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleProfileUpdate}
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                  >
                    Save Changes
                  </button>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Password Section */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <KeyIcon className="h-6 w-6" />
            Change Password
          </h2>
          <div className="mt-4 space-y-4">
            <div className="relative">
              <label className="block text-sm font-medium">New Password</label>
              <input
                type={showPassword ? "text" : "password"}
                value={password.new}
                onChange={(e) => setPassword({ ...password, new: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-8 text-gray-500"
              >
                {showPassword ? (
                  <EyeSlashIcon className="h-5 w-5" />
                ) : (
                  <EyeIcon className="h-5 w-5" />
                )}
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium">Confirm New Password</label>
              <input
                type="password"
                value={password.confirm}
                onChange={(e) => setPassword({ ...password, confirm: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={handlePasswordChange}
                disabled={isSubmitting || !password.new || !password.confirm || password.new !== password.confirm}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
              >
                Update Password
              </button>
            </div>
          </div>
        </section>

        {/* Notification Settings */}
        <section className="bg-white dark:bg-dark-surface rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold flex items-center gap-2 dark:text-white">
            <BellIcon className="h-6 w-6" />
            Notification Settings
          </h2>
          <div className="mt-4 space-y-4">
            <div className="notification-settings">
              {isLoading ? (
                <div className="py-2 flex items-center justify-center">
                  <ArrowPathIcon className="h-5 w-5 animate-spin text-gray-500 dark:text-gray-400" />
                  <span className="ml-2 text-gray-500 dark:text-gray-400">Loading notification settings...</span>
                </div>
              ) : !('Notification' in window) ? (
                <p className="text-red-500 dark:text-red-400">Notifications are not supported in your browser</p>
              ) : Notification.permission === 'denied' ? (
                <p className="text-red-500 dark:text-red-400">
                  Notifications are blocked. To enable them, click the lock/info icon in your browser's address bar,
                  then allow notifications.
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between py-2">
                    <label htmlFor="chatNotifications" className="flex-grow dark:text-white">
                      Chat Messages
                      <p className="text-sm text-gray-500 dark:text-gray-400">Get notified when you receive new chat messages</p>
                    </label>
                    <div className="relative">
                      <Switch
                        id="chatNotifications"
                        checked={notificationSettings.chatNotifications}
                        onChange={(checked) => handleNotificationToggle('chatNotifications', checked)}
                        disabled={isSubmitting || !isOnline}
                        className={`${
                          notificationSettings.chatNotifications ? 'bg-black dark:bg-white' : 'bg-gray-200 dark:bg-gray-700'
                        } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:ring-offset-2 ${
                          isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <span
                          className={`${
                            notificationSettings.chatNotifications ? 'translate-x-6' : 'translate-x-1'
                          } inline-block h-4 w-4 transform rounded-full bg-white dark:bg-black transition-transform`}
                        />
                      </Switch>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <label htmlFor="topicNotifications" className="flex-grow dark:text-white">
                      Topic Responses
                      <p className="text-sm text-gray-500 dark:text-gray-400">Get notified when someone responds to your topics</p>
                    </label>
                    <div className="relative">
                      <Switch
                        id="topicNotifications"
                        checked={notificationSettings.topicNotifications}
                        onChange={(checked) => handleNotificationToggle('topicNotifications', checked)}
                        disabled={isSubmitting || !isOnline}
                        className={`${
                          notificationSettings.topicNotifications ? 'bg-black dark:bg-white' : 'bg-gray-200 dark:bg-gray-700'
                        } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:ring-offset-2 ${
                          isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <span
                          className={`${
                            notificationSettings.topicNotifications ? 'translate-x-6' : 'translate-x-1'
                          } inline-block h-4 w-4 transform rounded-full bg-white dark:bg-black transition-transform`}
                        />
                      </Switch>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <label htmlFor="systemNotifications" className="flex-grow dark:text-white">
                      System Notifications
                      <p className="text-sm text-gray-500 dark:text-gray-400">Get notified about important system updates</p>
                    </label>
                    <div className="relative">
                      <Switch
                        id="systemNotifications"
                        checked={notificationSettings.systemNotifications}
                        onChange={(checked) => handleNotificationToggle('systemNotifications', checked)}
                        disabled={isSubmitting || !isOnline}
                        className={`${
                          notificationSettings.systemNotifications ? 'bg-black dark:bg-white' : 'bg-gray-200 dark:bg-gray-700'
                        } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:ring-offset-2 ${
                          isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <span
                          className={`${
                            notificationSettings.systemNotifications ? 'translate-x-6' : 'translate-x-1'
                          } inline-block h-4 w-4 transform rounded-full bg-white dark:bg-black transition-transform`}
                        />
                      </Switch>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Privacy Settings */}
        <section className="bg-white dark:bg-dark-surface rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold flex items-center gap-2 dark:text-white">
            <ShieldCheckIcon className="h-6 w-6" />
            Privacy Settings
          </h2>
          <div className="mt-4 space-y-4">
            {Object.entries(privacy).map(([key, enabled]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm font-medium capitalize dark:text-white">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </span>
                <Switch
                  checked={enabled}
                  onChange={() => handlePrivacyChange(key)}
                  className={`${
                    enabled ? 'bg-black dark:bg-white' : 'bg-gray-200 dark:bg-gray-700'
                  } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:ring-offset-2`}
                >
                  <span
                    className={`${
                      enabled ? 'translate-x-6' : 'translate-x-1'
                    } inline-block h-4 w-4 transform rounded-full bg-white dark:bg-black transition-transform`}
                  />
                </Switch>
              </div>
            ))}
          </div>
        </section>

        {/* Theme Settings */}
        <section className="bg-white dark:bg-dark-surface rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold flex items-center gap-2 dark:text-white">
            <PaintBrushIcon className="h-6 w-6" />
            Theme Settings
          </h2>
          <div className="mt-4">
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => handleThemeChange('light')}
                className={`p-3 rounded-lg border-2 ${
                  theme === 'light' ? 'border-black dark:border-white' : 'border-gray-200 dark:border-gray-700'
                } flex items-center justify-center gap-2 transition-colors dark:text-white`}
              >
                <SunIcon className="h-5 w-5" />
                <span>Light</span>
              </button>
              <button
                onClick={() => handleThemeChange('dark')}
                className={`p-3 rounded-lg border-2 ${
                  theme === 'dark' ? 'border-black dark:border-white' : 'border-gray-200 dark:border-gray-700'
                } flex items-center justify-center gap-2 transition-colors dark:text-white`}
              >
                <MoonIcon className="h-5 w-5" />
                <span>Dark</span>
              </button>
              <button
                onClick={() => handleThemeChange('system')}
                className={`p-3 rounded-lg border-2 ${
                  theme === 'system' ? 'border-black dark:border-white' : 'border-gray-200 dark:border-gray-700'
                } flex items-center justify-center gap-2 transition-colors dark:text-white`}
              >
                <ComputerDesktopIcon className="h-5 w-5" />
                <span>System</span>
              </button>
            </div>
          </div>
        </section>

        {/* Data Management */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Cog6ToothIcon className="h-6 w-6" />
            Data Management
          </h2>
          <div className="mt-4 space-y-4">
            <div className="flex gap-4">
                    <button
                onClick={handleClearTopics}
                disabled={isClearing}
                className="flex-1 p-4 rounded-lg border-2 border-red-200 hover:border-red-500 flex items-center justify-center gap-2 text-red-600 hover:text-red-700"
                    >
                <TrashIcon className="h-5 w-5" />
                Clear All Topics
                    </button>
                      <button
                onClick={handleResetSettings}
                disabled={isSubmitting}
                className="flex-1 p-4 rounded-lg border-2 border-gray-200 hover:border-primary-500 flex items-center justify-center gap-2"
              >
                <ArrowPathIcon className="h-5 w-5" />
                Reset All Settings
                      </button>
            </div>
          </div>
        </section>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
          <CheckCircleIcon className="h-5 w-5" />
          {successMessage}
      </div>
        )}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
          <XCircleIcon className="h-5 w-5" />
          {error}
        </div>
      )}
    </div>
  );
};

export default Settings; 