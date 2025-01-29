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
export const validateFile = (file) => {
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/heic',  // Added HEIC support
    'image/heif'   // Added HEIF support
  ];

  if (!file) {
    throw new Error('Please select a file to upload');
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    throw new Error(`File size (${sizeMB}MB) exceeds the 10MB limit. Please choose a smaller file.`);
  }

  // Check file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`File type "${file.type}" is not supported. Please use JPEG, PNG, GIF, HEIC, or HEIF images.`);
  }

  // Additional image validation
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      if (img.width === 0 || img.height === 0) {
        reject(new Error('The selected file appears to be corrupted or invalid. Please choose another image.'));
      }
      resolve(true);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('The selected file could not be loaded as an image. Please choose a valid image file.'));
    };
    
    img.src = objectUrl;
  });
}; 

