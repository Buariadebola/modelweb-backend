const mongoose = require('mongoose');

const modelSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: [true, 'Admin reference is required.'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required.'],
      trim: true,
      maxlength: [80, 'Name cannot exceed 80 characters.'],
    },
    username: {
      type: String,
      required: [true, 'Username is required.'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-zA-Z0-9._-]+$/, 'Username can only contain letters, numbers, periods, underscores, and hyphens.'],
    },
    slug: {
      type: String,
      required: [true, 'Slug is required.'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    profileImage: {
      type: String,
      default: '',
    },
    profileImagePublicId: {
      type: String,
      default: '',
    },
    bio: {
      type: String,
      default: '',
      maxlength: [500, 'Bio cannot exceed 500 characters.'],
    },
    location: {
      type: String,
      default: '',
      maxlength: [120, 'Location cannot exceed 120 characters.'],
    },
    categories: {
      type: [String],
      default: [],
      validate: {
        validator: function validateCategories(value) {
          return value.every((item) => typeof item === 'string' && item.trim().length > 0);
        },
        message: 'Categories must be a list of non-empty strings.',
      },
    },
    height: {
      type: String,
      default: '',
      maxlength: [40, 'Height cannot exceed 40 characters.'],
    },
    experience: {
      type: String,
      default: '',
      maxlength: [80, 'Experience cannot exceed 80 characters.'],
    },
    availability: {
      type: String,
      default: 'Available',
      maxlength: [40, 'Availability cannot exceed 40 characters.'],
    },
    followersCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    followingCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    postsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

modelSchema.index({ isActive: 1, createdAt: -1 });

module.exports = mongoose.model('Model', modelSchema);
