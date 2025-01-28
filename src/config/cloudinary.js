import { Cloudinary } from '@cloudinary/url-gen';

// Initialize Cloudinary configuration
const cld = new Cloudinary({
  cloud: {
    cloudName: process.env.REACT_APP_CLOUDINARY_CLOUD_NAME
  },
  url: {
    secure: true // Force HTTPS
  }
});

export default cld; 
