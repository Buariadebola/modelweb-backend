const { Readable } = require('node:stream');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadToCloudinary = async ({ file, folder, resourceType = 'image', publicId = null }) => {
  if (!file || !file.buffer) {
    throw new Error('No file buffer provided for upload.');
  }

  const uploadOptions = {
    folder,
    resource_type: resourceType,
    ...(publicId ? { public_id: publicId } : {}),
  };

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) {
        reject(new Error(error.message || 'Cloudinary upload failed.'));
        return;
      }

      resolve(result);
    });

    Readable.from(file.buffer).pipe(stream);
  });
};

const deleteFromCloudinary = async ({ publicId, resourceType = 'image' }) => {
  if (!publicId) {
    return { result: 'not_found' };
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });

    return result;
  } catch (error) {
    throw new Error(error.message || 'Cloudinary deletion failed.');
  }
};

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary,
};
