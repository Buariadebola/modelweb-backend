const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: [true, 'Conversation is required'],
      index: true,
    },

    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Sender ID is required'],
    },

    senderType: {
      type: String,
      enum: ['client', 'model'],
      required: [true, 'Sender type is required'],
    },

    text: {
      type: String,
      trim: true,
      default: '',
    },

    messageType: {
      type: String,
      enum: ['text', 'image', 'video'],
      default: 'text',
    },

    mediaUrl: {
      type: String,
      default: '',
    },

    mediaPublicId: {
      type: String,
      default: '',
    },

    mediaMimeType: {
      type: String,
      default: '',
    },

    read: {
      type: Boolean,
      default: false,
    },
    edited: {
      type: Boolean,
      default: false,
    },

    deleted: {
      type: Boolean,
      default: false,
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Message', messageSchema);