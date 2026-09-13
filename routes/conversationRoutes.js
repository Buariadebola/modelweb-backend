const express = require('express');
const {
  getMyConversation,
  getAllConversations,
  getConversationById,
} = require('../controllers/conversationController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/my', authMiddleware, getMyConversation);
router.get('/', authMiddleware, getAllConversations);
router.get('/:conversationId', authMiddleware, getConversationById);

module.exports = router;
