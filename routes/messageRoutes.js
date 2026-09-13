const express = require('express');
const {
  getMessagesByConversation,
  createMessage,
  markMessageAsRead,
  editMessage,
  deleteMessage,
} = require('../controllers/messageController');
const authMiddleware = require('../middleware/authMiddleware');
const { chatMediaUpload } = require('../middleware/uploadMiddleware');

const router = express.Router();

router.get('/:conversationId', authMiddleware, getMessagesByConversation);
router.post('/', authMiddleware, chatMediaUpload, createMessage);
router.patch('/:messageId/read', authMiddleware, markMessageAsRead);
router.patch('/:messageId', authMiddleware, editMessage);
router.delete('/:messageId', authMiddleware, deleteMessage);

module.exports = router;
