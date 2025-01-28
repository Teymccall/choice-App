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
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { ref, onValue, update, remove, get } from 'firebase/database';
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

  const handleNotificationChange = async (setting) => {
    if (!isOnline || !user?.uid) return;

    try {
      const newSettings = {
        ...notificationSettings,
        [setting]: !notificationSettings[setting]
      };

      const settingsRef = ref(rtdb, `userSettings/${user.uid}/notifications`);
      await update(settingsRef, newSettings);
      
      setNotificationSettings(newSettings);
      setSuccessMessage('Notification settings updated');
      setTimeout(() => setSuccessMessage(''), 2000);
    } catch (err) {
      console.error('Error updating notification settings:', err);
      setError(err.message || 'Failed to update notification settings');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handlePrivacyChange = async (key) => {
    if (!isOnline) return;

    try {
      const newPrivacySettings = {
        ...privacy,
        [key]: !privacy[key]
      };

      const privacyRef = ref(rtdb, `userSettings/${user.uid}/privacy`);
      await update(privacyRef, newPrivacySettings);
      
      setPrivacy(newPrivacySettings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Error updating privacy settings:', error);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!isOnline || !user?.uid) return;

    // Validate passwords
    if (!password.current || !password.new || !password.confirm) {
      setError('All password fields are required');
      return;
    }

    if (password.new !== password.confirm) {
      setError('New passwords do not match');
      return;
    }

    if (password.new.length < 6) {
      setError('New password must be at least 6 characters long');
      return;
    }

    try {
      setIsSubmitting(true);
      // Update password in Firebase Auth
      await updatePassword(user, password.new);
      
      // Clear password fields
      setPassword({
        current: '',
        new: '',
        confirm: ''
      });
      
      setSuccessMessage('Password updated successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error updating password:', err);
      setError(err.message || 'Failed to update password');
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProfileChange = async (e) => {
    e.preventDefault();
    if (!isOnline || !user?.uid) return;

    try {
      setIsSubmitting(true);
      
      // Update display name in Firebase Auth
      await updateProfile(user, {
        displayName: profile.displayName
      });

      // Update display name in Realtime Database
      const profileRef = ref(rtdb, `userSettings/${user.uid}/profile`);
      await update(profileRef, {
        displayName: profile.displayName
      });
      
      setSuccessMessage('Profile updated successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
      setIsEditing(false);
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err.message || 'Failed to update profile');
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!isOnline || !user?.uid) return;

    try {
      const profileRef = ref(rtdb, `userSettings/${user.uid}/profile`);
      await update(profileRef, {
        displayName: profile.displayName
      });
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  const handleSaveChanges = () => {
    // Simulate saving changes
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Add padding-top to account for fixed navigation */}
      <div className="pt-20 pb-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Manage your account preferences and settings</p>
          </div>

          {/* Settings Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Profile & Password */}
            <div className="lg:col-span-2 space-y-6">
              {/* Profile Section */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-3">
                      <UserCircleIcon className="h-7 w-7 text-primary-600 dark:text-primary-400" />
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Profile</h2>
                    </div>
                    <div className="flex items-center space-x-2">
                      {isEditing && (
                        <button
                          onClick={handleProfileChange}
                          disabled={!isOnline || isSubmitting}
                          className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 dark:bg-primary-500 dark:hover:bg-primary-600"
                        >
                          {isSubmitting ? 'Saving...' : 'Save Changes'}
                        </button>
                      )}
                      <button
                        onClick={() => setIsEditing(!isEditing)}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
                      >
                        {isEditing ? 'Cancel' : 'Edit Profile'}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                      <input
                        type="email"
                        value={profile.email}
                        disabled
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Name</label>
                      <input
                        type="text"
                        value={profile.displayName}
                        onChange={(e) => setProfile(prev => ({ ...prev, displayName: e.target.value }))}
                        disabled={!isEditing}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50 dark:disabled:bg-gray-700 disabled:cursor-not-allowed transition-all duration-200 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Password Section */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-6">
                  <div className="flex items-center space-x-3 mb-6">
                    <KeyIcon className="h-7 w-7 text-primary-600 dark:text-primary-400" />
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Password</h2>
                  </div>
                  <form onSubmit={handlePasswordChange} className="space-y-4">
                    {['current', 'new', 'confirm'].map((field) => (
                      <div key={field}>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {field.charAt(0).toUpperCase() + field.slice(1)} Password
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={password[field]}
                            onChange={(e) => setPassword(prev => ({ ...prev, [field]: e.target.value }))}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 pr-10 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 dark:bg-gray-700 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2"
                          >
                            {showPassword ? (
                              <EyeSlashIcon className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                            ) : (
                              <EyeIcon className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      type="submit"
                      disabled={isSubmitting || !isOnline}
                      className="w-full mt-4 px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 dark:bg-primary-500 dark:hover:bg-primary-600"
                    >
                      {isSubmitting ? 'Updating...' : 'Update Password'}
                    </button>
                  </form>
                </div>
              </div>
            </div>

            {/* Right Column - Notifications & Theme */}
            <div className="space-y-6">
              {/* Manual Section */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-3">
                      <BookOpenIcon className="h-7 w-7 text-primary-600 dark:text-primary-400" />
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">User Manual</h2>
                    </div>
                    <button
                      onClick={() => setShowManual(!showManual)}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
                    >
                      {showManual ? 'Hide Manual' : 'Show Manual'}
                    </button>
                  </div>
                  {showManual && (
                    <div className="space-y-4 animate-fade-in">
                      {manualSections.map((section, index) => (
                        <div key={section.title} className="animate-slide-up" style={{ animationDelay: `${index * 100}ms` }}>
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{section.title}</h3>
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

              {/* Clear Topics Section */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-6">
                  <div className="flex items-center space-x-3 mb-6">
                    <TrashIcon className="h-7 w-7 text-red-600 dark:text-red-400" />
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Clear Data</h2>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Clear all topics and related data. This action cannot be undone.
                  </p>
                  <button
                    onClick={handleClearTopics}
                    disabled={isClearing || !isOnline}
                    className="w-full px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 dark:bg-red-500 dark:hover:bg-red-600"
                  >
                    {isClearing ? 'Clearing...' : 'Clear All Topics'}
                  </button>
                </div>
              </div>

              {/* Notifications Section */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-6">
                  <div className="flex items-center space-x-3 mb-6">
                    <BellIcon className="h-7 w-7 text-primary-600 dark:text-primary-400" />
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Notifications</h2>
                  </div>
                  <div className="space-y-4">
                    {Object.entries(notificationSettings).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {key.split(/(?=[A-Z])/).join(' ')}
                        </span>
                        <Switch
                          checked={value}
                          onChange={() => handleNotificationChange(key)}
                          className={`${
                            value ? 'bg-primary-600 dark:bg-primary-500' : 'bg-gray-200 dark:bg-gray-600'
                          } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2`}
                        >
                          <span
                            className={`${
                              value ? 'translate-x-6' : 'translate-x-1'
                            } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                          />
                        </Switch>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Theme Section */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-6">
                  <div className="flex items-center space-x-3 mb-6">
                    <SunIcon className="h-7 w-7 text-primary-600 dark:text-primary-400" />
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Theme</h2>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'light', icon: SunIcon, label: 'Light' },
                      { id: 'dark', icon: MoonIcon, label: 'Dark' },
                      { id: 'system', icon: ComputerDesktopIcon, label: 'System' }
                    ].map((option) => (
                      <button
                        key={option.id}
                        onClick={() => handleThemeChange(option.id)}
                        disabled={isSubmitting}
                        className={`flex flex-col items-center p-3 rounded-lg border ${
                          theme === option.id
                            ? 'border-primary-600 bg-primary-50 text-primary-700 dark:border-primary-400 dark:bg-primary-900/20 dark:text-primary-400'
                            : 'border-gray-200 hover:border-gray-300 text-gray-600 dark:border-gray-600 dark:hover:border-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        } transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <option.icon className={`h-6 w-6 mb-1 ${
                          theme === option.id ? 'text-primary-600 dark:text-primary-400' : ''
                        }`} />
                        <span className="text-sm font-medium">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {(error || successMessage) && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg ${
          error ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400' : 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400'
        } transition-all duration-500 transform translate-y-0`}>
          <p className="text-sm font-medium">
            {error || successMessage}
          </p>
        </div>
      )}
    </div>
  );
};

export default Settings; 