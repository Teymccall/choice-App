import React, { useState, useEffect } from 'react';
import { UserCircleIcon, PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from 'firebase/auth';
import { ref, update, get, onValue, off } from 'firebase/database';
import { rtdb } from '../firebase/config';
import { uploadMedia, validateFile } from '../utils/mediaUpload';
import { auth } from '../firebase/config';

const ProfilePictureModal = ({ photoURL, onClose, displayName }) => {
  return (
    <div 
      className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center" 
      onClick={onClose}
    >
      <button 
        className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <XMarkIcon className="h-6 w-6" />
      </button>
      <img 
        src={photoURL} 
        alt={displayName || 'Profile'} 
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
        onClick={e => e.stopPropagation()}
        loading="eager"
        decoding="sync"
        onLoad={(e) => {
          e.target.style.opacity = 1;
        }}
        style={{ opacity: 0, transition: 'opacity 0.2s ease-in-out' }}
      />
    </div>
  );
};

const ProfilePicture = ({ 
  size = 'md', 
  editable = false,
  userId,
  photoURL: propPhotoURL,
  displayName: propDisplayName 
}) => {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  
  // If specific user photo is provided, use it; otherwise use current user's photo
  const isCurrentUser = !userId || userId === user?.uid;
  const [localPhotoURL, setLocalPhotoURL] = useState(isCurrentUser ? user?.photoURL : propPhotoURL);
  const displayName = isCurrentUser ? user?.displayName : propDisplayName;

  // Listen for real-time updates to the user's photo URL
  useEffect(() => {
    if (!isCurrentUser || !user?.uid) return;

    const userSettingsRef = ref(rtdb, `userSettings/${user.uid}/profile`);
    const unsubscribe = onValue(userSettingsRef, (snapshot) => {
      if (snapshot.exists()) {
        const profileData = snapshot.val();
        if (profileData.photoURL) {
          setLocalPhotoURL(profileData.photoURL);
        }
      }
    });

    return () => {
      off(userSettingsRef);
    };
  }, [isCurrentUser, user?.uid]);

  // Update localPhotoURL when user.photoURL or propPhotoURL changes
  useEffect(() => {
    if (isCurrentUser) {
      setLocalPhotoURL(user?.photoURL);
    } else {
      setLocalPhotoURL(propPhotoURL);
    }
  }, [user?.photoURL, propPhotoURL, isCurrentUser]);

  // Only show edit functionality for current user
  const showEdit = editable && isCurrentUser;

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-16 h-16'
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setError(null);

      // Check if user is authenticated
      if (!auth.currentUser) {
        throw new Error('You must be logged in to update your profile picture');
      }

      console.log('Starting upload process...', { userId: auth.currentUser.uid });

      // Validate file first
      await validateFile(file);
      console.log('File validation passed');

      // Upload to Cloudinary using existing utility
      const mediaData = await uploadMedia(file);
      console.log('Cloudinary upload successful:', mediaData);

      // Set local photo URL immediately after successful upload
      setLocalPhotoURL(mediaData.url);

      // Update both Firebase Auth and RTDB simultaneously
      try {
        const updates = {
          photoURL: mediaData.url,
          photoPublicId: mediaData.publicId,
          photoUpdatedAt: new Date().toISOString()
        };

        // Create an array of promises for all updates
        const updatePromises = [
          // Update Firebase Auth profile
          updateProfile(auth.currentUser, { photoURL: mediaData.url }),
          // Update user settings in RTDB
          update(ref(rtdb, `userSettings/${auth.currentUser.uid}/profile`), updates),
          // Update user profile in RTDB
          update(ref(rtdb, `users/${auth.currentUser.uid}`), updates)
        ];

        // Wait for all updates to complete
        await Promise.all(updatePromises);
        console.log('All profile updates successful');

        // Verify the updates
        const verifyPromises = [
          // Verify Firebase Auth update
          auth.currentUser.reload().then(() => {
            if (auth.currentUser.photoURL !== mediaData.url) {
              console.warn('Firebase Auth photoURL mismatch');
            }
          }),
          // Verify RTDB updates
          get(ref(rtdb, `userSettings/${auth.currentUser.uid}/profile`)).then((snapshot) => {
            if (snapshot.exists() && snapshot.val().photoURL !== mediaData.url) {
              console.warn('RTDB settings photoURL mismatch');
            }
          }),
          get(ref(rtdb, `users/${auth.currentUser.uid}`)).then((snapshot) => {
            if (snapshot.exists() && snapshot.val().photoURL !== mediaData.url) {
              console.warn('RTDB users photoURL mismatch');
            }
          })
        ];

        await Promise.all(verifyPromises);
        console.log('Profile update verification complete');

      } catch (updateError) {
        console.error('Error updating profile:', updateError);
        throw new Error('Failed to update profile. Please try again.');
      }

    } catch (err) {
      console.error('Error uploading profile picture:', err);
      setError(err.message || 'Failed to upload profile picture');
      setLocalPhotoURL(user?.photoURL);
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  return (
    <div className="relative flex-shrink-0">
      <div 
        className={`
          ${sizeClasses[size]} 
          rounded-full 
          overflow-hidden 
          bg-white
          dark:bg-gray-900
          ${localPhotoURL ? 'cursor-pointer' : ''} 
          ring-2
          ring-white/80
          dark:ring-gray-800/80
          shadow-[0_2px_4px_rgba(0,0,0,0.05)]
        `}
        onClick={() => localPhotoURL && setShowPreview(true)}
      >
        {localPhotoURL ? (
          <div className="w-full h-full">
            <img
              src={localPhotoURL}
              alt={displayName || 'User'}
              className="w-full h-full object-cover"
              loading="eager"
              style={{
                imageRendering: '-webkit-optimize-contrast',
                WebkitFontSmoothing: 'antialiased',
                MozOsxFontSmoothing: 'grayscale',
                backfaceVisibility: 'hidden',
                transform: 'translateZ(0)',
                willChange: 'transform',
                filter: 'brightness(1.02) contrast(1.05)',
              }}
              draggable="false"
              onLoad={(e) => {
                e.target.style.opacity = '1';
              }}
              onError={(e) => {
                e.target.style.opacity = '0.8';
              }}
            />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
            <UserCircleIcon className="w-[75%] h-[75%] text-gray-400 dark:text-gray-600" />
          </div>
        )}
      </div>

      {showEdit && (
        <label
          className="absolute -bottom-0.5 -right-0.5 p-1 bg-white dark:bg-gray-900 rounded-full shadow-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ring-2 ring-white/80 dark:ring-gray-800/80"
          htmlFor="profile-picture-upload"
        >
          <PhotoIcon className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
          <input
            type="file"
            id="profile-picture-upload"
            className="hidden"
            accept="image/*"
            onChange={handleFileSelect}
            disabled={isUploading}
          />
        </label>
      )}

      {error && (
        <div className="absolute top-full mt-1 left-1/2 transform -translate-x-1/2 bg-red-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap shadow-lg">
          {error}
        </div>
      )}

      {isUploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full backdrop-blur-sm">
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {showPreview && localPhotoURL && (
        <ProfilePictureModal 
          photoURL={localPhotoURL} 
          displayName={displayName}
          onClose={() => setShowPreview(false)} 
        />
      )}
    </div>
  );
};

export default ProfilePicture; 