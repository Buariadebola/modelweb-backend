const express = require('express');

const {
  likePost,
  unlikePost,
  getPostLikeStatus,
  getLikedPostIds
} = require('../controllers/modelPostLikeController');

const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.post(
  '/:postId/like',
  authMiddleware,
  likePost
);

router.delete(
  '/:postId/like',
  authMiddleware,
  unlikePost
);

router.get(
  '/:postId/like',
  authMiddleware,
  getPostLikeStatus
);

router.get("/liked", authMiddleware, getLikedPostIds);

module.exports = router;