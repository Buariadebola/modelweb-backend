const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { uploadToCloudinary } = require('../services/cloudinaryService');

const getConversationAccess = async (user, conversationId) => {
  const conversation = await Conversation.findById(conversationId);

  if (!conversation) {
    return {
      conversation: null,
      authorized: false,
      message: 'Conversation not found.',
    };
  }

  if (user.type === 'model') {
    return {
      conversation,
      authorized: true,
      message: 'Authorized.',
    };
  }

  if (user.type === 'client' && conversation.client.toString() === user.id) {
    return {
      conversation,
      authorized: true,
      message: 'Authorized.',
    };
  }

  return {
    conversation,
    authorized: false,
    message: 'You are not authorized to access this conversation.',
  };
};

const getMessagesByConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const { conversation, authorized, message } = await getConversationAccess(req.user, conversationId);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found.',
      });
    }

    if (!authorized) {
      return res.status(403).json({
        success: false,
        message,
      });
    }

    const messages = await Message.find({ conversation: conversation._id }).sort({ createdAt: 1 });

    return res.json({
      success: true,
      data: messages,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Unable to fetch messages.',
    });
  }
};

const createMessage = async (req, res) => {
  try {
    console.log('Incoming message request:', {
      body: req.body,
      hasFile: Boolean(req.file),
      fileName: req.file?.originalname,
      mimeType: req.file?.mimetype,
    });

    const { conversationId, text = '' } = req.body;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: 'Conversation ID is required.',
      });
    }

    const trimmedText = String(text || '').trim();

    if (!trimmedText && !req.file) {
      return res.status(400).json({
        success: false,
        message: 'Message text or media is required.',
      });
    }

    const { conversation, authorized, message } =
      await getConversationAccess(req.user, conversationId);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found.',
      });
    }

    if (!authorized) {
      return res.status(403).json({
        success: false,
        message,
      });
    }

    let messageType = 'text';
    let mediaUrl = '';
    let mediaPublicId = '';
    let mediaMimeType = '';

    if (req.file) {
      const isImage = req.file.mimetype.startsWith('image/');
      const isVideo = req.file.mimetype.startsWith('video/');

      if (!isImage && !isVideo) {
        return res.status(400).json({
          success: false,
          message: 'Only images and videos are allowed.',
        });
      }

      messageType = isImage ? 'image' : 'video';
      mediaMimeType = req.file.mimetype;

      const uploadedMedia = await uploadToCloudinary({
        file: req.file,
        folder: `messages/${conversation._id}`,
        resourceType: isVideo ? 'video' : 'image',
      });

      mediaUrl = uploadedMedia.secure_url;
      mediaPublicId = uploadedMedia.public_id;
    }

    const messagePayload = {
      conversation: conversation._id,
      senderId: req.user.id,
      senderType: req.user.type === 'client' ? 'client' : 'model',
      text: trimmedText,
      messageType,
      mediaUrl,
      mediaPublicId,
      mediaMimeType,
    };

    const newMessage = await Message.create(messagePayload);

    conversation.lastMessage = newMessage._id;
    conversation.lastMessageAt = new Date();

    await conversation.save();

    const io = req.app.get('io');

    if (io) {
      io.to(String(conversation._id)).emit('receive_message', {
        ...newMessage.toObject(),
        conversation: conversation._id.toString(),
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Message sent successfully.',
      data: newMessage,
    });
  } catch (error) {
    console.error('Create message error:', error);

    return res.status(500).json({
      success: false,
      message: error.message || 'Unable to send message.',
    });
  }
};

const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { text = '' } = req.body;

    const trimmedText = String(text || '').trim();

    if (!trimmedText) {
      return res.status(400).json({
        success: false,
        message: 'Message text is required.',
      });
    }

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found.',
      });
    }

    // Only the sender can edit their own message
    if (
      message.senderId.toString() !== String(req.user.id) ||
      message.senderType !== req.user.type
    ) {
      return res.status(403).json({
        success: false,
        message: 'You can only edit your own messages.',
      });
    }

    if (message.deleted) {
      return res.status(400).json({
        success: false,
        message: 'Deleted messages cannot be edited.',
      });
    }

    // Only text messages can be edited
    if (message.messageType !== 'text') {
      return res.status(400).json({
        success: false,
        message: 'Only text messages can be edited.',
      });
    }

    message.text = trimmedText;
    message.edited = true;

    await message.save();

    const io = req.app.get('io');

    if (io) {
      io.to(String(message.conversation)).emit(
        'message_edited',
        {
          message: message.toObject(),
        }
      );
    }

    return res.json({
      success: true,
      message: 'Message updated successfully.',
      data: message,
    });
  } catch (error) {
    console.error('Edit message error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to edit message.',
    });
  }
};

const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found.',
      });
    }

    // Only the sender can delete their own message
    if (
      message.senderId.toString() !== String(req.user.id) ||
      message.senderType !== req.user.type
    ) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own messages.',
      });
    }

    if (message.deleted) {
      return res.status(400).json({
        success: false,
        message: 'Message is already deleted.',
      });
    }

    message.deleted = true;
    message.deletedAt = new Date();
    message.text = '';
    message.mediaUrl = '';
    message.mediaPublicId = '';
    message.mediaMimeType = '';

    await message.save();

    const io = req.app.get('io');

    if (io) {
      io.to(String(message.conversation)).emit(
        'message_deleted',
        {
          messageId: message._id,
          conversationId: message.conversation,
        }
      );
    }

    return res.json({
      success: true,
      message: 'Message deleted successfully.',
      data: message,
    });
  } catch (error) {
    console.error('Delete message error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to delete message.',
    });
  }
};

const markMessageAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found.',
      });
    }

    const conversation = await Conversation.findById(message.conversation);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found.',
      });
    }

    const user = req.user;

    if (user.type === 'client') {
      const isOwnConversation = conversation.client.toString() === user.id;
      const isModelMessage = message.senderType === 'model';

      if (!isOwnConversation || !isModelMessage) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to mark this message as read.',
        });
      }
    }

    if (user.type === 'model') {
      const isClientMessage = message.senderType === 'client';

      if (!isClientMessage) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to mark this message as read.',
        });
      }
    }

    message.read = true;
    await message.save();

    const io = req.app.get('io');

    if (io) {
      io.to(String(conversation._id)).emit('message_read', {
        messageId: message._id,
        conversationId: conversation._id,
        userId: user.id,
        userType: user.type,
      });
    }

    return res.json({
      success: true,
      message: 'Message marked as read.',
      data: message,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Unable to update read status.',
    });
  }
};

module.exports = {
  getConversationAccess,
  getMessagesByConversation,
  createMessage,
  markMessageAsRead,
  editMessage,
  deleteMessage,
};
