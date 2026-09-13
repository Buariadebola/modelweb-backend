const mongoose = require('mongoose');

const modelPostLikeSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ModelPost',
      required: [true, 'Post is required.'],
      index: true,
    },

    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: [true, 'Client is required.'],
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// One client can only like a post once.
modelPostLikeSchema.index(
  { post: 1, client: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  'ModelPostLike',
  modelPostLikeSchema
);