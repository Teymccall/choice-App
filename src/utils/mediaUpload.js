// Remove unused import
// import cloudinary from '../config/cloudinary';

// Function to upload media to Cloudinary
export const uploadMedia = async (file) => {
  try {
    console.log('Starting upload for file:', file.name);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'choice_app_preset');
    formData.append('cloud_name', 'dmfoxrq1v');
    formData.append('api_key', '151487395476985');
    
    console.log('Uploading to Cloudinary...');
    
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/dmfoxrq1v/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    console.log('Response status:', response.status);
    const responseData = await response.json();
    console.log('Response data:', responseData);

    if (!response.ok) {
      console.error('Upload failed with status:', response.status);
      console.error('Error details:', responseData);
      throw new Error(responseData.error?.message || 'Upload failed');
    }

    console.log('Upload successful:', responseData);
    
    return {
      url: responseData.secure_url,
      publicId: responseData.public_id,
      resourceType: responseData.resource_type,
      format: responseData.format
    };
  } catch (error) {
    console.error('Detailed upload error:', error);
    console.error('Error stack:', error.stack);
    throw new Error(`Failed to upload image: ${error.message}`);
  }
};

// Function to validate file before upload
export const validateFile = (file) => {
  try {
    console.log('Validating file:', file.name);
    console.log('File type:', file.type);
    console.log('File size:', file.size);

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const ALLOWED_TYPES = [
      'image/jpeg',
      'image/png',
      'image/gif'
    ];

    if (!file) {
      throw new Error('No file selected');
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds 10MB limit`);
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error(`File type ${file.type} not supported. Only JPEG, PNG and GIF are allowed`);
    }

    console.log('File validation successful');
    return true;
  } catch (error) {
    console.error('Validation error:', error);
    throw error;
  }
}; 

