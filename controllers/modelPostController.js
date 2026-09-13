const mongoose = require('mongoose');
const Model = require('../models/Model');
const ModelPost = require('../models/ModelPost');
const { uploadToCloudinary, deleteFromCloudinary } = require('../services/cloudinaryService');

const parseBoolean = (value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.toLowerCase().trim();
    return ['true', '1', 'yes', 'on'].includes(normalized);
  }

  return Boolean(value);
};

const getRequiredModel = async (req, res, modelId, allowAnyAdmin = false) => {
  if (!mongoose.isValidObjectId(modelId)) {
    return {
      error: res.status(400).json({
        success: false,
        message: 'Invalid model ID.',
      }),
    };
  }

  const model = await Model.findById(modelId);

  if (!model) {
    return {
      error: res.status(404).json({
        success: false,
        message: 'Model not found.',
      }),
    };
  }

  if (!allowAnyAdmin && model.adminId && model.adminId.toString() !== req.user.id) {
    return {
      error: res.status(403).json({
        success: false,
        message: 'You are not authorized to manage this model.',
      }),
    };
  }

  return { model };
};

const getRequiredPost = async (req, res, modelId, postId) => {
  if (!mongoose.isValidObjectId(postId)) {
    return {
      error: res.status(400).json({
        success: false,
        message: 'Invalid post ID.',
      }),
    };
  }

  const post = await ModelPost.findById(postId);

  if (!post) {
    return {
      error: res.status(404).json({
        success: false,
        message: 'Post not found.',
      }),
    };
  }

  if (post.modelId.toString() !== modelId) {
    return {
      error: res.status(400).json({
        success: false,
        message: 'Post does not belong to this model.',
      }),
    };
  }

  return { post };
};

const normalizeMediaType = (mimetype) => {
  if (!mimetype) {
    return null;
  }

  if (mimetype.startsWith('image/')) {
    return 'image';
  }

  if (mimetype.startsWith('video/')) {
    return 'video';
  }

  return null;
};

const buildMediaEntries = async ({ files, modelId, folder }) => {
  if (!Array.isArray(files) || files.length === 0) {
    return [];
  }

  const mediaEntries = [];

  for (const file of files) {
    const mediaType = normalizeMediaType(file.mimetype);

    if (!mediaType) {
      throw new Error('Unsupported media type. Please upload an image or video.');
    }

    const fileSizeLimit = mediaType === 'video' ? 100 * 1024 * 1024 : 10 * 1024 * 1024;

    if (file.size > fileSizeLimit) {
      throw new Error(
        mediaType === 'video'
          ? 'Video files must be 100MB or smaller.'
          : 'Image files must be 10MB or smaller.'
      );
    }

    const uploadResult = await uploadToCloudinary({
      file,
      folder,
      resourceType: mediaType,
    });

    mediaEntries.push({
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      type: mediaType,
      thumbnailUrl: uploadResult.thumbnail_url || '',
    });
  }

  return mediaEntries;
};

const createModelPost = async (req, res, next) => {
  try {
    const { modelId } = req.params;
    const accessCheck = await getRequiredModel(req, res, modelId, false);

    if (accessCheck.error) {
      return accessCheck.error;
    }

    const model = accessCheck.model;
    const files = Array.isArray(req.files) ? req.files : req.file ? [req.file] : [];

    if (!files.length) {
      return res.status(400).json({
        success: false,
        message: 'At least one media file is required.',
      });
    }

    if (files.length > 10) {
      return res.status(400).json({
        success: false,
        message: 'You can upload up to 10 media files per post.',
      });
    }

    let uploadedMedia = [];
    const caption = String(req.body.caption || '').trim();

    try {
      uploadedMedia = await buildMediaEntries({
        files,
        modelId,
        folder: `models/${model._id}/posts`,
      });

      const primaryMedia = uploadedMedia[0];
      const post = await ModelPost.create({
        modelId: model._id,
        media: uploadedMedia,
        mediaUrl: primaryMedia?.url || '',
        mediaPublicId: primaryMedia?.publicId || '',
        mediaType: primaryMedia?.type || 'image',
        thumbnailUrl: primaryMedia?.thumbnailUrl || '',
        caption,
        isPublished: parseBoolean(req.body.isPublished ?? true),
      });

      model.postsCount = (model.postsCount || 0) + 1;
      await model.save();

      return res.status(201).json({
        success: true,
        message: 'Model post created successfully.',
        data: post,
      });
    } catch (error) {
      if (uploadedMedia.length) {
        for (const item of uploadedMedia) {
          try {
            await deleteFromCloudinary({
              publicId: item.publicId,
              resourceType: item.type,
            });
          } catch (cleanupError) {
            console.error('Failed to clean up uploaded post media after create failure:', cleanupError.message);
          }
        }
      }

      throw error;
    }
  } catch (error) {
    return next(error);
  }
};

const updateModelPost = async (req, res, next) => {
  try {
    const { modelId, postId } = req.params;

    const modelCheck = await getRequiredModel(req, res, modelId, false);
    if (modelCheck.error) {
      return modelCheck.error;
    }

    const postCheck = await getRequiredPost(req, res, modelId, postId);
    if (postCheck.error) {
      return postCheck.error;
    }

    const post = postCheck.post;
    const oldPostSnapshot = await ModelPost.findById(postId).lean();
    const nextData = {};

    if (req.body.caption !== undefined) {
      nextData.caption = String(req.body.caption || '').trim();
    }

    if (req.body.isPublished !== undefined) {
      nextData.isPublished = parseBoolean(req.body.isPublished);
    }

    let uploadedReplacement = [];
    const files = Array.isArray(req.files) ? req.files : req.file ? [req.file] : [];

    if (files.length > 0) {
      if (files.length > 10) {
        return res.status(400).json({
          success: false,
          message: 'You can upload up to 10 media files per post.',
        });
      }

      uploadedReplacement = await buildMediaEntries({
        files,
        modelId,
        folder: `models/${modelId}/posts`,
      });

      const primaryMedia = uploadedReplacement[0];
      nextData.media = uploadedReplacement;
      nextData.mediaUrl = primaryMedia?.url || '';
      nextData.mediaPublicId = primaryMedia?.publicId || '';
      nextData.mediaType = primaryMedia?.type || 'image';
      nextData.thumbnailUrl = primaryMedia?.thumbnailUrl || post.thumbnailUrl || '';
    }

    if (Object.keys(nextData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid post fields were provided for update.',
      });
    }

    try {
      Object.assign(post, nextData);
      await post.save();
    } catch (error) {
      if (uploadedReplacement.length) {
        for (const item of uploadedReplacement) {
          try {
            await deleteFromCloudinary({
              publicId: item.publicId,
              resourceType: item.type,
            });
          } catch (cleanupError) {
            console.error('Failed to clean up replacement media after post update failure:', cleanupError.message);
          }
        }
      }

      throw error;
    }

    const previousMediaItems = Array.isArray(oldPostSnapshot?.media) ? oldPostSnapshot.media : [];

    if (uploadedReplacement.length && previousMediaItems.length) {
      for (const oldMedia of previousMediaItems) {
        if (oldMedia.publicId) {
          try {
            await deleteFromCloudinary({
              publicId: oldMedia.publicId,
              resourceType: oldMedia.type || oldPostSnapshot.mediaType || 'image',
            });
          } catch (cloudinaryError) {
            console.error('Failed to remove old post media from Cloudinary:', cloudinaryError.message);
          }
        }
      }
    }

    return res.json({
      success: true,
      message: 'Post updated successfully.',
      data: post,
    });
  } catch (error) {
    return next(error);
  }
};

const deleteModelPost = async (req, res, next) => {
  try {
    const { modelId, postId } = req.params;

    const modelCheck = await getRequiredModel(req, res, modelId, false);
    if (modelCheck.error) {
      return modelCheck.error;
    }

    const model = modelCheck.model;
    const postCheck = await getRequiredPost(req, res, modelId, postId);
    if (postCheck.error) {
      return postCheck.error;
    }

    const post = postCheck.post;
    const mediaItems = Array.isArray(post.media) ? post.media : [];

    for (const item of mediaItems) {
      if (item.publicId) {
        try {
          await deleteFromCloudinary({
            publicId: item.publicId,
            resourceType: item.type || post.mediaType || 'image',
          });
        } catch (cloudinaryError) {
          console.error('Failed to remove post media from Cloudinary:', cloudinaryError.message);
        }
      }
    }

    if (post.mediaPublicId) {
      try {
        await deleteFromCloudinary({
          publicId: post.mediaPublicId,
          resourceType: post.mediaType,
        });
      } catch (cloudinaryError) {
        console.error('Failed to remove legacy post media from Cloudinary:', cloudinaryError.message);
      }
    }

    await ModelPost.findByIdAndDelete(postId);

    model.postsCount = Math.max((model.postsCount || 0) - 1, 0);
    await model.save();

    return res.json({
      success: true,
      message: 'Post deleted successfully.',
      data: { deletedPostId: postId },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createModelPost,
  updateModelPost,
  deleteModelPost,
  normalizeMediaType,
  parseBoolean,
};
