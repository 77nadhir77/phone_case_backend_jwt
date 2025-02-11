const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require('dotenv').config()

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'uploads',
    public_id: (req, file) => file.originalname.split('.')[0] + '-' + Date.now(), // Custom filename
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif'], // Allowed file types
  }
});

module.exports = { storage };