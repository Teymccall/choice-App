// Remove unused import
// import cloudinary from '../config/cloudinary';

// Function to upload media to Cloudinary
export const uploadMedia = async (file) => {
  try {
    if (!process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET || 
        !process.env.REACT_APP_CLOUDINARY_CLOUD_NAME) {
      throw new Error('Cloudinary configuration is missing');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET);
    formData.append('cloud_name', process.env.REACT_APP_CLOUDINARY_CLOUD_NAME);
    
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME}/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to upload image to cloud storage');
    }

    const responseData = await response.json();
    
    return {
      url: responseData.secure_url,
      publicId: responseData.public_id,
      resourceType: responseData.resource_type,
      format: responseData.format
    };
  } catch (error) {
    console.error('Upload error:', error);
    if (error.message.includes('configuration')) {
      throw new Error('Unable to upload image due to configuration issue. Please try again later.');
    } else if (error.message.includes('NetworkError')) {
      throw new Error('Network error while uploading. Please check your connection and try again.');
    } else {
      throw new Error(`Failed to upload image: ${error.message}`);
    }
  }
};

// Function to validate file before upload
export const validateFile = async (file) => {
  // Get file extension
  const extension = file.name.split('.').pop()?.toLowerCase();
  
  // Check if file exists
  if (!file) {
    throw new Error('Please select a file');
  }

  // Check file type
  if (file.type.startsWith('image/')) {
    // Image validation
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/heic', 'image/heif'];
    if (!allowedImageTypes.includes(file.type)) {
      throw new Error('Please use JPEG, PNG, GIF, HEIC, or HEIF images.');
    }
  } else if (file.type.startsWith('audio/')) {
    // Audio validation
    const allowedAudioTypes = ['audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/wav'];
    if (!allowedAudioTypes.includes(file.type)) {
      throw new Error('Unsupported audio format. Please use MP3, WAV, or WebM.');
    }
  } else if (file.type.startsWith('video/')) {
    // Video validation
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (!allowedVideoTypes.includes(file.type)) {
      throw new Error('Please use MP4, WebM, or QuickTime videos.');
    }
  } else {
    throw new Error('Unsupported file type. Please use images, audio, or videos.');
  }

  // Check file size (max 50MB)
  const maxSize = 50 * 1024 * 1024; // 50MB in bytes
  if (file.size > maxSize) {
    throw new Error('File size must be less than 50MB');
  }

  return true;
}; 

