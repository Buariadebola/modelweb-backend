const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const socketAuthMiddleware = require('../middleware/socketAuthMiddleware');
const { getConversationAccess } = require('../controllers/messageController');

const onlineUsers = new Map();

module.exports = (io) => {
  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    const key = `${socket.user.type}:${socket.user.id}`;
    onlineUsers.set(key, {
      userId: socket.user.id,
      userType: socket.user.type,
      socketId: socket.id,
    });

    io.emit('user_online', {
      userId: socket.user.id,
      userType: socket.user.type,
      online: true,
    });

    socket.on('join_conversation', async ({ conversationId }) => {
      try {
        if (!conversationId) {
          socket.emit('error', { message: 'Conversation ID is required.' });
          return;
        }

        const { conversation, authorized, message } = await getConversationAccess(socket.user, conversationId);

        if (!conversation) {
          socket.emit('error', { message: 'Conversation not found.' });
          return;
        }

        if (!authorized) {
          socket.emit('error', { message });
          return;
        }

        socket.join(String(conversation._id));
        socket.emit('conversation_joined', { conversationId: String(conversation._id) });
      } catch (error) {
        socket.emit('error', { message: 'Unable to join conversation.' });
      }
    });

    socket.on('send_message', async ({ conversationId, text }) => {
      try {
        if (!conversationId) {
          socket.emit('error', { message: 'Conversation ID is required.' });
          return;
        }

        if (!text || !String(text).trim()) {
          socket.emit('error', { message: 'Message text cannot be empty.' });
          return;
        }

        const { conversation, authorized, message } = await getConversationAccess(socket.user, conversationId);

        if (!conversation) {
          socket.emit('error', { message: 'Conversation not found.' });
          return;
        }

        if (!authorized) {
          socket.emit('error', { message });
          return;
        }

        const newMessage = await Message.create({
          conversation: conversation._id,
          senderId: socket.user.id,
          senderType: socket.user.type === 'client' ? 'client' : 'model',
          text: String(text).trim(),
        });

        conversation.lastMessage = newMessage._id;
        conversation.lastMessageAt = new Date();
        await conversation.save();

        io.to(String(conversation._id)).emit('receive_message', {
          ...newMessage.toObject(),
          conversation: String(conversation._id),
        });
      } catch (error) {
        socket.emit('error', { message: 'Unable to send message.' });
      }
    });

    socket.on('typing_start', ({ conversationId }) => {
      if (!conversationId) {
        return;
      }

      socket.to(String(conversationId)).emit('typing_start', {
        conversationId: String(conversationId),
        userId: socket.user.id,
        userType: socket.user.type,
      });
    });

    socket.on('typing_stop', ({ conversationId }) => {
      if (!conversationId) {
        return;
      }

      socket.to(String(conversationId)).emit('typing_stop', {
        conversationId: String(conversationId),
        userId: socket.user.id,
        userType: socket.user.type,
      });
    });

    socket.on('message_read', async ({ messageId, conversationId }) => {
      try {
        if (!messageId || !conversationId) {
          socket.emit('error', { message: 'Message ID and conversation ID are required.' });
          return;
        }

        const message = await Message.findById(messageId);

        if (!message) {
          socket.emit('error', { message: 'Message not found.' });
          return;
        }

        const conversation = await Conversation.findById(conversationId);

        if (!conversation) {
          socket.emit('error', { message: 'Conversation not found.' });
          return;
        }

        const isClientReadAllowed = socket.user.type === 'client'
          && conversation.client.toString() === socket.user.id
          && message.senderType === 'model';

        const isModelReadAllowed = socket.user.type === 'model'
          && message.senderType === 'client';

        if (!isClientReadAllowed && !isModelReadAllowed) {
          socket.emit('error', { message: 'You are not authorized to mark this message as read.' });
          return;
        }

        message.read = true;
        await message.save();

        io.to(String(conversation._id)).emit('message_read', {
          messageId: message._id,
          conversationId: String(conversation._id),
          userId: socket.user.id,
          userType: socket.user.type,
        });
      } catch (error) {
        socket.emit('error', { message: 'Unable to update read status.' });
      }
    });

    socket.on('disconnect', () => {
      onlineUsers.delete(key);
      io.emit('user_offline', {
        userId: socket.user.id,
        userType: socket.user.type,
        online: false,
      });
    });
  });
};
