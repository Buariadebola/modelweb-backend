const multer = require('multer');

const storage = multer.memoryStorage();

const imageMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const videoMimeTypes = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-msvideo',
  'video/3gpp',
]);

const allowedMimeTypes = new Set([...imageMimeTypes, ...videoMimeTypes]);

const buildUploadMiddleware = ({ fieldName = 'media', maxSize, allowedMimeTypeSet = allowedMimeTypes, errorMessage, multiple = false, maxFiles = 10 }) => {
  const uploader = multer({
    storage,
    limits: {
      fileSize: maxSize,
      files: maxFiles,
    },
    fileFilter: (req, file, cb) => {
      if (!allowedMimeTypeSet.has(file.mimetype)) {
        return cb(new Error(errorMessage), false);
      }

      const normalizedName = (file.originalname || '').toLowerCase();
      const hasAllowedExtension = [...imageMimeTypes, ...videoMimeTypes].some((mimeType) => {
        const extension = mimeType.split('/')[1];
        return normalizedName.endsWith(extension) || normalizedName.endsWith(`.${extension}`);
      });

      if (!hasAllowedExtension && !allowedMimeTypeSet.has(file.mimetype)) {
        return cb(new Error(errorMessage), false);
      }

      cb(null, true);
    },
  });

  return multiple ? uploader.array(fieldName, maxFiles) : uploader.single(fieldName);
};

const profileImageUpload = buildUploadMiddleware({
  fieldName: 'profileImage',
  maxSize: 10 * 1024 * 1024,
  allowedMimeTypeSet: imageMimeTypes,
  errorMessage: 'Only image files are allowed for profile images. Maximum size is 10MB.',
});

const mediaUpload = buildUploadMiddleware({
  fieldName: 'media',
  maxSize: 100 * 1024 * 1024,
  allowedMimeTypeSet: allowedMimeTypes,
  errorMessage: 'Only image and video files are allowed for posts. Maximum size is 100MB.',
  multiple: true,
  maxFiles: 10,
});

const chatMediaUpload = buildUploadMiddleware({
  fieldName: 'media',
  maxSize: 100 * 1024 * 1024,
  allowedMimeTypeSet: allowedMimeTypes,
  errorMessage: 'Only image and video files are allowed for chat. Maximum size is 100MB.',
  multiple: false,
  maxFiles: 1,
});

module.exports = {
  profileImageUpload,
  mediaUpload,
  chatMediaUpload,
  allowedMimeTypes,
};
