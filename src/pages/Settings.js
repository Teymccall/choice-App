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

  const applyTheme = (themeName) => {
    try {
      const root = document.documentElement;
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const shouldBeDark = themeName === 'dark' || (themeName === 'system' && isSystemDark);

      // Remove existing theme classes
      root.classList.remove('light', 'dark');
      
      // Apply theme class
      if (shouldBeDark) {
        root.classList.add('dark');
      } else {
        root.classList.add('light');
      }

      // Update localStorage
      if (themeName === 'system') {
        localStorage.removeItem('theme');
      } else {
        localStorage.setItem('theme', themeName);
      }

      return true;
    } catch (error) {
      console.error('Error applying theme:', error);
      return false;
    }
  };

  const handleThemeChange = async (newTheme) => {
    if (!isOnline || !user?.uid) {
      setError('You must be online to change settings');
      return;
    }

    try {
      setIsSubmitting(true);
      
      // First try to apply the theme
      const themeApplied = applyTheme(newTheme);
      if (!themeApplied) {
        throw new Error('Failed to apply theme to document');
      }

      // Update Firebase with consistent path
      const settingsRef = ref(rtdb, `userSettings/${user.uid}/theme`);
      await update(settingsRef, {
        preference: newTheme,
        updatedAt: serverTimestamp()
      });
      
      // Update local state
      setTheme(newTheme);
      setIsDarkMode(newTheme === 'dark' || (newTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches));
      
      setSuccessMessage('Theme updated successfully');
      setTimeout(() => setSuccessMessage(''), 2000);
    } catch (err) {
      console.error('Error updating theme:', err);
      
      // Try to rollback theme changes
      try {
        applyTheme(theme); // Revert to previous theme
      } catch (rollbackErr) {
        console.error('Error rolling back theme:', rollbackErr);
      }
      
      if (err.code === 'PERMISSION_DENIED') {
        setError('Permission denied. Please check if you are logged in.');
      } else {
        setError(`Failed to update theme: ${err.message}`);
      }
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add system theme change listener
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleSystemThemeChange = (e) => {
      if (theme === 'system') {
        applyTheme('system');
        setIsDarkMode(e.matches);
      }
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, [theme]);

  // Initialize theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'system';
    applyTheme(savedTheme);
      setTheme(savedTheme);
  }, []);

  // Update the Firebase sync effect to match the new path
  useEffect(() => {
    if (!user?.uid) return;

    const themeRef = ref(rtdb, `userSettings/${user.uid}/theme`);
    const unsubscribe = onValue(themeRef, (snapshot) => {
      const data = snapshot.val();
      if (data?.preference && data.preference !== theme) {
        applyTheme(data.preference);
        setTheme(data.preference);
      }
    });

    return () => unsubscribe();
  }, [user?.uid, theme]);

  // Fetch notification settings and unread count
  useEffect(() => {
    if (!user?.uid) return;

    const settingsRef = ref(rtdb, `userSettings/${user.uid}/notifications`);
    const notificationsRef = ref(rtdb, `notifications/${user.uid}`);
    
    const settingsUnsubscribe = onValue(settingsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setNotificationSettings(data);
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
        setProfile(prev => ({
          ...prev,
          ...data,
          displayName: user.displayName || data.displayName || '',
          email: user.email || data.email || ''
        }));
      }
    });

    return () => profileUnsubscribe();
  }, [user?.uid, user?.displayName, user?.email]);

  const handleNotificationChange = async (key) => {
    if (!isOnline || !user?.uid) {
      setError('You must be online to change settings');
      return;
    }

    try {
      setIsSubmitting(true);
      const newSettings = {
        ...notificationSettings,
        [key]: !notificationSettings[key]
      };

      const settingsRef = ref(rtdb, `userSettings/${user.uid}/notifications`);
      await update(settingsRef, newSettings);
      
      setNotificationSettings(newSettings);
      setSuccessMessage('Notification settings updated');
      setTimeout(() => setSuccessMessage(''), 2000);
    } catch (err) {
      console.error('Error updating notification settings:', err);
      setError('Failed to update notification settings');
    } finally {
      setIsSubmitting(false);
    }
  };

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
      
      // First update Firebase Auth profile
      await updateProfile(user, {
        displayName: profile.displayName.trim()
      });

      // Then update profile in database
      const profileRef = ref(rtdb, `userSettings/${user.uid}/profile`);
      await update(profileRef, {
        displayName: profile.displayName.trim(),
        email: user.email, // Use authenticated email
        updatedAt: serverTimestamp()
      });

      // Update any related user data
      const userRef = ref(rtdb, `users/${user.uid}`);
      await update(userRef, {
        displayName: profile.displayName.trim(),
        updatedAt: serverTimestamp()
      });

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
          chatMessages: true,
          topicResponses: true,
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

      const getPairingId = (email1, email2) => {
        const sortedEmails = [email1, email2].sort();
        return `${sortedEmails[0]}_${sortedEmails[1]}`;
      };

      const userPairingId = partner ? getPairingId(user.email, partner.email) : null;
      
      // Find and remove topics for this user's pairing
      const batch = {};
      Object.entries(topics).forEach(([topicId, topic]) => {
        if (topic.pairingId === userPairingId) {
          batch[`topics/${topicId}`] = null;
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
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <BellIcon className="h-6 w-6" />
            Notification Settings
          </h2>
          <div className="mt-4 space-y-4">
            {Object.entries(notificationSettings).map(([key, enabled]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm font-medium capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </span>
                <Switch
                  checked={enabled}
                  onChange={() => handleNotificationChange(key)}
                  className={`${
                    enabled ? 'bg-primary-600' : 'bg-gray-200'
                  } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2`}
                >
                  <span
                    className={`${
                      enabled ? 'translate-x-6' : 'translate-x-1'
                    } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                  />
                </Switch>
              </div>
            ))}
          </div>
        </section>

        {/* Privacy Settings */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ShieldCheckIcon className="h-6 w-6" />
            Privacy Settings
          </h2>
          <div className="mt-4 space-y-4">
            {Object.entries(privacy).map(([key, enabled]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm font-medium capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </span>
                <Switch
                  checked={enabled}
                  onChange={() => handlePrivacyChange(key)}
                  className={`${
                    enabled ? 'bg-primary-600' : 'bg-gray-200'
                  } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2`}
                >
                  <span
                    className={`${
                      enabled ? 'translate-x-6' : 'translate-x-1'
                    } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                  />
                </Switch>
              </div>
            ))}
          </div>
        </section>

        {/* Theme Settings */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <PaintBrushIcon className="h-6 w-6" />
            Theme Settings
          </h2>
          <div className="mt-4 space-y-4">
            <div className="flex gap-4">
              <button
                onClick={() => handleThemeChange('light')}
                className={`flex-1 p-4 rounded-lg border-2 ${
                  theme === 'light' ? 'border-primary-500' : 'border-gray-200'
                } flex items-center justify-center gap-2`}
              >
                <SunIcon className="h-5 w-5" />
                Light
              </button>
              <button
                onClick={() => handleThemeChange('dark')}
                className={`flex-1 p-4 rounded-lg border-2 ${
                  theme === 'dark' ? 'border-primary-500' : 'border-gray-200'
                } flex items-center justify-center gap-2`}
              >
                <MoonIcon className="h-5 w-5" />
                Dark
              </button>
              <button
                onClick={() => handleThemeChange('system')}
                className={`flex-1 p-4 rounded-lg border-2 ${
                  theme === 'system' ? 'border-primary-500' : 'border-gray-200'
                } flex items-center justify-center gap-2`}
              >
                <ComputerDesktopIcon className="h-5 w-5" />
                System
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