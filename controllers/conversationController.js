const Conversation = require('../models/Conversation');
const Admin = require('../models/Admin');
const Model = require('../models/Model');

const populateConversation = (query) => {
  return query
    .populate('client', 'name email phone')
    .populate({
      path: 'lastMessage',
      select: 'text senderType createdAt read',
    });
};

const getMyConversation = async (req, res) => {
  try {
    if (req.user.type !== 'client') {
      return res.status(403).json({
        success: false,
        message: 'Only clients can access their own conversation.',
      });
    }

    let conversation = await populateConversation(
      Conversation.findOne({ client: req.user.id })
    );

    const modelAdmin = await Admin.findOne();

    if (!modelAdmin) {
      return res.status(404).json({
        success: false,
        message: 'The model account has not been configured yet.',
      });
    }

    const model = await Model.findOne({
      adminId: modelAdmin._id,
      isActive: true,
    }).select('name username profileImage');

    if (!model) {
      return res.status(404).json({
        success: false,
        message: 'The model profile has not been configured yet.',
      });
    }

    if (!conversation) {
      conversation = await Conversation.create({
        client: req.user.id,
      });

      conversation = await populateConversation(
        Conversation.findById(conversation._id)
      );
    }

    return res.json({
      success: true,
      data: {
        ...conversation.toObject(),
        model: {
          id: model._id,
          name: model.name,
          username: model.username,
          profileImage: model.profileImage,
        },
      },
    });
  } catch (error) {
    console.error('Get my conversation error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to fetch your conversation.',
    });
  }
};

const getAllConversations = async (req, res) => {
  try {
    if (req.user.type !== 'model') {
      return res.status(403).json({
        success: false,
        message: 'Only the model can view all client conversations.',
      });
    }

    const conversations = await populateConversation(
      Conversation.find().sort({ lastMessageAt: -1, createdAt: -1 })
    );

    return res.json({
      success: true,
      data: conversations,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Unable to fetch conversations.',
    });
  }
};

const getConversationById = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const conversation = await populateConversation(
      Conversation.findById(conversationId)
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found.',
      });
    }

    if (req.user.type === 'model') {
      return res.json({
        success: true,
        data: conversation,
      });
    }

    if (req.user.type === 'client' && conversation.client._id.toString() === req.user.id) {
      return res.json({
        success: true,
        data: conversation,
      });
    }

    return res.status(403).json({
      success: false,
      message: 'You are not authorized to access this conversation.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Unable to fetch conversation.',
    });
  }
};

module.exports = {
  getMyConversation,
  getAllConversations,
  getConversationById,
};
