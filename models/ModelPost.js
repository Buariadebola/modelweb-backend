const mongoose = require('mongoose');

const modelMediaItemSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: [true, 'Media URL is required.'],
    },

    publicId: {
      type: String,
      default: '',
    },

    type: {
      type: String,
      required: [true, 'Media type is required.'],
      enum: {
        values: ['image', 'video'],
        message: 'Media type must be image or video.',
      },
    },

    thumbnailUrl: {
      type: String,
      default: '',
    },
  },
  { _id: false }
);

const modelPostSchema = new mongoose.Schema(
  {
    modelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Model',
      required: [true, 'Model reference is required.'],
      index: true,
    },

    media: {
      type: [modelMediaItemSchema],
      default: [],
      validate: {
        validator: function validateMedia(value) {
          return Array.isArray(value) && value.length > 0;
        },
        message: 'At least one media item is required.',
      },
    },

    mediaUrl: {
      type: String,
      default: '',
    },

    mediaPublicId: {
      type: String,
      default: '',
    },

    mediaType: {
      type: String,
      default: 'image',
      enum: {
        values: ['image', 'video'],
        message: 'Media type must be image or video.',
      },
    },

    thumbnailUrl: {
      type: String,
      default: '',
    },

    caption: {
      type: String,
      default: '',
      maxlength: [
        2000,
        'Caption cannot exceed 2000 characters.',
      ],
    },

    // Total displayed likes.
    // This includes automatic likes + real client likes.
    likesCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Number of likes generated automatically.
    autoLikesCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Used to determine when another automatic
    // 7 or 8 likes should be added.
    lastAutoLikeAt: {
      type: Date,
      default: null,
    },

    commentsCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    isPublished: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

modelPostSchema.index({
  modelId: 1,
  createdAt: -1,
});

modelPostSchema.index({
  isPublished: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  'ModelPost',
  modelPostSchema
);