const mongoose = require('mongoose');
const Model = require('../models/Model');
const ModelPost = require('../models/ModelPost');
const { uploadToCloudinary } = require('../services/cloudinaryService');
const { normalizeUsername, buildUniqueSlug, makeSlug } = require('../utils/slugify');

const ALLOWED_MODEL_FIELDS = [
  'name',
  'username',
  'bio',
  'location',
  'categories',
  'height',
  'experience',
  'availability',
  'isVerified',
  'isActive',
];

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

const stripSensitiveModelData = (modelRecord) => {
  if (!modelRecord) {
    return null;
  }

  const record = modelRecord.toObject ? modelRecord.toObject() : { ...modelRecord };
  const {
    adminId,
    profileImagePublicId,
    __v,
    ...safeRecord
  } = record;

  return {
    ...safeRecord,
    followersCount: Number(safeRecord.followersCount || 0),
    followingCount: Number(safeRecord.followingCount || 0),
    postsCount: Number(safeRecord.postsCount || 0),
  };
};

const ensureModelAccess = async (req, res, modelId, allowAnyAdmin = false) => {
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

const getPublicModels = async (req, res, next) => {
  try {
    const models = await Model.find({
      isActive: true,
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      data: {
        models: models.map((model) => stripSensitiveModelData(model)),
      },
    });
  } catch (error) {
    return next(error);
  }
};

const createModel = async (req, res, next) => {
  try {
    const { name, username, bio = '', location = '', categories = [], height = '', experience = '', availability = 'Available' } = req.body;

    if (!name || !username) {
      return res.status(400).json({
        success: false,
        message: 'Name and username are required.',
      });
    }

    const normalizedUsername = normalizeUsername(username);

    if (!normalizedUsername) {
      return res.status(400).json({
        success: false,
        message: 'Username contains invalid characters.',
      });
    }

    const existingModel = await Model.findOne({ username: normalizedUsername });

    if (existingModel) {
      return res.status(409).json({
        success: false,
        message: 'A model with this username already exists.',
      });
    }

    const slug = await buildUniqueSlug(Model, name || normalizedUsername);
    const modelPayload = {
      adminId: req.user.id,
      name: String(name).trim(),
      username: normalizedUsername,
      slug,
      bio: String(bio || '').trim(),
      location: String(location || '').trim(),
      categories: Array.isArray(categories)
        ? categories.map((category) => String(category).trim()).filter(Boolean)
        : [],
      height: String(height || '').trim(),
      experience: String(experience || '').trim(),
      availability: String(availability || 'Available').trim(),
    };

    let uploadedProfileResult = null;

    if (req.file) {
      uploadedProfileResult = await uploadToCloudinary({
        file: req.file,
        folder: `models/${req.user.id}/profile`,
        resourceType: 'image',
      });

      modelPayload.profileImage = uploadedProfileResult.secure_url;
      modelPayload.profileImagePublicId = uploadedProfileResult.public_id;
    }

    try {
      const model = await Model.create(modelPayload);

      return res.status(201).json({
        success: true,
        message: 'Model created successfully.',
        data: stripSensitiveModelData(model),
      });
    } catch (error) {
      if (uploadedProfileResult && uploadedProfileResult.public_id) {
        try {
          const { deleteFromCloudinary } = require('../services/cloudinaryService');
          await deleteFromCloudinary({
            publicId: uploadedProfileResult.public_id,
            resourceType: 'image',
          });
        } catch (cleanupError) {
          console.error('Failed to clean up uploaded profile image after model create failure:', cleanupError.message);
        }
      }

      throw error;
    }
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Duplicate username or slug detected.',
      });
    }

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return next(error);
  }
};

const listModelsAdmin = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(Math.max(1, Number(req.query.limit) || 20), 100);
    const search = String(req.query.search || '').trim();
    const statusFilter = String(req.query.status || 'all').toLowerCase();
    const skip = (page - 1) * limit;

    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
      ];
    }

    if (statusFilter === 'active') {
      query.isActive = true;
    }

    if (statusFilter === 'inactive') {
      query.isActive = false;
    }

    const [models, total] = await Promise.all([
      Model.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Model.countDocuments(query),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return res.json({
      success: true,
      data: {
        models: models.map((model) => stripSensitiveModelData(model)),
      },
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const getAdminModelDetails = async (req, res, next) => {
  try {
    const { modelId } = req.params;

    const accessCheck = await ensureModelAccess(req, res, modelId, true);
    if (accessCheck.error) {
      return accessCheck.error;
    }

    const model = accessCheck.model;
    const posts = await ModelPost.find({ modelId: model._id }).sort({ createdAt: -1 }).lean();

    return res.json({
      success: true,
      data: {
        model: stripSensitiveModelData(model),
        posts,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const updateModel = async (req, res, next) => {
  try {
    const { modelId } = req.params;

    const accessCheck = await ensureModelAccess(req, res, modelId, false);
    if (accessCheck.error) {
      return accessCheck.error;
    }

    const model = accessCheck.model;
    const updateData = {};

    for (const field of ALLOWED_MODEL_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updateData[field] = req.body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid model fields were provided for update.',
      });
    }

    if (updateData.username) {
      const normalizedUsername = normalizeUsername(updateData.username);

      if (!normalizedUsername) {
        return res.status(400).json({
          success: false,
          message: 'Username contains invalid characters.',
        });
      }

      const duplicate = await Model.findOne({
        username: normalizedUsername,
        _id: { $ne: model._id },
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: 'A model with this username already exists.',
        });
      }

      updateData.username = normalizedUsername;
      updateData.slug = await buildUniqueSlug(Model, updateData.name || model.name || normalizedUsername, model._id);
    }

    if (updateData.name) {
      updateData.name = String(updateData.name).trim();
    }

    if (updateData.bio !== undefined) {
      updateData.bio = String(updateData.bio || '').trim();
    }

    if (updateData.location !== undefined) {
      updateData.location = String(updateData.location || '').trim();
    }

    if (updateData.categories !== undefined) {
      updateData.categories = Array.isArray(updateData.categories)
        ? updateData.categories.map((category) => String(category).trim()).filter(Boolean)
        : [];
    }

    if (updateData.height !== undefined) {
      updateData.height = String(updateData.height || '').trim();
    }

    if (updateData.experience !== undefined) {
      updateData.experience = String(updateData.experience || '').trim();
    }

    if (updateData.availability !== undefined) {
      updateData.availability = String(updateData.availability || '').trim();
    }

    if (updateData.isVerified !== undefined) {
      updateData.isVerified = parseBoolean(updateData.isVerified);
    }

    if (updateData.isActive !== undefined) {
      updateData.isActive = parseBoolean(updateData.isActive);
    }

    Object.assign(model, updateData);
    await model.save();

    return res.json({
      success: true,
      message: 'Model updated successfully.',
      data: stripSensitiveModelData(model),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Duplicate username or slug detected.',
      });
    }

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return next(error);
  }
};

const getDefaultModel = async (req, res, next) => {
  try {
    let model = await Model.findOne({
      isDefault: true,
      isActive: true,
    })
      .sort({ createdAt: -1 })
      .lean();

    // Safety fallback:
    // If no model is marked default, use the newest active model.
    if (!model) {
      model = await Model.findOne({
        isActive: true,
      })
        .sort({ createdAt: -1 })
        .lean();
    }

    if (!model) {
      return res.status(404).json({
        success: false,
        message: 'No active model is available.',
      });
    }

    return res.json({
      success: true,
      data: {
        model: stripSensitiveModelData(model),
      },
    });
  } catch (error) {
    return next(error);
  }
};


const setDefaultModel = async (modelId) => {
  try {
    const response = await api.patch(
      `/admin/models/${modelId}/default`
    );

    const updatedModel = response.data?.data?.model;

    if (!updatedModel) {
      throw new Error('Updated model was not returned by the server.');
    }

    setModels((currentModels) =>
      currentModels.map((item) => ({
        ...item,
        isDefault: String(item._id || item.id) === String(modelId),
      }))
    );

    return normalizeModel(updatedModel);
  } catch (error) {
    console.error('Failed to set default model:', error);
    throw error;
  }
};


const updateProfileImage = async (req, res, next) => {
  try {
    const { modelId } = req.params;

    const accessCheck = await ensureModelAccess(req, res, modelId, false);
    if (accessCheck.error) {
      return accessCheck.error;
    }

    const model = accessCheck.model;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'A profile image file is required.',
      });
    }

    const uploadResult = await uploadToCloudinary({
      file: req.file,
      folder: `models/${model._id}/profile`,
      resourceType: 'image',
    });

    const previousPublicId = model.profileImagePublicId;

    try {
      model.profileImage = uploadResult.secure_url;
      model.profileImagePublicId = uploadResult.public_id;
      await model.save();

      if (previousPublicId && previousPublicId !== uploadResult.public_id) {
        try {
          const { deleteFromCloudinary } = require('../services/cloudinaryService');
          await deleteFromCloudinary({
            publicId: previousPublicId,
            resourceType: 'image',
          });
        } catch (cloudinaryError) {
          console.error('Failed to remove old profile image from Cloudinary:', cloudinaryError.message);
        }
      }

      return res.json({
        success: true,
        message: 'Profile image updated successfully.',
        data: stripSensitiveModelData(model),
      });
    } catch (error) {
      try {
        const { deleteFromCloudinary } = require('../services/cloudinaryService');
        await deleteFromCloudinary({
          publicId: uploadResult.public_id,
          resourceType: 'image',
        });
      } catch (cleanupError) {
        console.error('Failed to clean up uploaded profile image after save failure:', cleanupError.message);
      }

      throw error;
    }
  } catch (error) {
    return next(error);
  }
};

const getPublicModelProfile = async (req, res, next) => {
  try {
    const username = String(req.params.username || '').trim().toLowerCase();

    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Model username is required.',
      });
    }

    const model = await Model.findOne({
      $or: [{ username: username }, { slug: username }],
      isActive: true,
    }).lean();

    if (!model) {
      return res.status(404).json({
        success: false,
        message: 'Model not found.',
      });
    }

    const posts = await ModelPost.find({
      modelId: model._id,
      isPublished: true,
    }).sort({ createdAt: -1 }).limit(12).lean();

    return res.json({
      success: true,
      data: {
        model: stripSensitiveModelData(model),
        posts,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const getPublicModelPosts = async (req, res, next) => {
  try {
    const { modelId } = req.params;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(Math.max(1, Number(req.query.limit) || 12), 50);
    const skip = (page - 1) * limit;

    if (!mongoose.isValidObjectId(modelId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid model ID.',
      });
    }

    const model = await Model.findOne({ _id: modelId, isActive: true }).lean();

    if (!model) {
      return res.status(404).json({
        success: false,
        message: 'Model not found.',
      });
    }

    const [posts, total] = await Promise.all([
      ModelPost.find({ modelId: model._id, isPublished: true })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ModelPost.countDocuments({ modelId: model._id, isPublished: true }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return res.json({
      success: true,
      data: {
        posts,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createModel,
  listModelsAdmin,
  getAdminModelDetails,
  updateModel,
  updateProfileImage,
  getPublicModels,
  getPublicModelProfile,
  getPublicModelPosts,
  stripSensitiveModelData,
  parseBoolean,
  makeSlug,
  getDefaultModel,
  setDefaultModel,
};
