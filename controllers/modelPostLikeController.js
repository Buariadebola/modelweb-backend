const mongoose = require('mongoose');

const ModelPost = require('../models/ModelPost');
const ModelPostLike = require('../models/ModelPostLike');

const likePost = async (req, res, next) => {
  try {
    const { postId } = req.params;

    if (!mongoose.isValidObjectId(postId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid post ID.',
      });
    }

    // Only clients can like posts.
    if (req.user?.type !== 'client') {
      return res.status(403).json({
        success: false,
        message: 'Only clients can like posts.',
      });
    }

    const post = await ModelPost.findById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found.',
      });
    }

    if (!post.isPublished) {
      return res.status(400).json({
        success: false,
        message: 'This post is not available.',
      });
    }

    const clientId = req.user.id;

    try {
      await ModelPostLike.create({
        post: post._id,
        client: clientId,
      });
    } catch (error) {
      // Duplicate like.
      if (error.code === 11000) {
        return res.json({
          success: true,
          liked: true,
          alreadyLiked: true,
          likesCount: post.likesCount,
        });
      }

      throw error;
    }

    // Only increase the count after creating
    // the user's unique like record.
    const updatedPost =
      await ModelPost.findByIdAndUpdate(
        post._id,
        {
          $inc: {
            likesCount: 1,
          },
        },
        {
          new: true,
        }
      );

    return res.json({
      success: true,
      liked: true,
      likesCount: updatedPost.likesCount,
    });
  } catch (error) {
    return next(error);
  }
};

const unlikePost = async (req, res, next) => {
  try {
    const { postId } = req.params;

    if (!mongoose.isValidObjectId(postId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid post ID.',
      });
    }

    if (req.user?.type !== 'client') {
      return res.status(403).json({
        success: false,
        message: 'Only clients can unlike posts.',
      });
    }

    const post = await ModelPost.findById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found.',
      });
    }

    const deletedLike =
      await ModelPostLike.findOneAndDelete({
        post: post._id,
        client: req.user.id,
      });

    // User had not liked it.
    if (!deletedLike) {
      return res.json({
        success: true,
        liked: false,
        alreadyUnliked: true,
        likesCount: post.likesCount,
      });
    }

    const updatedPost =
      await ModelPost.findByIdAndUpdate(
        post._id,
        {
          $inc: {
            likesCount: -1,
          },
        },
        {
          new: true,
        }
      );

    // Safety against a negative count.
    if (
      updatedPost &&
      updatedPost.likesCount < 0
    ) {
      updatedPost.likesCount = 0;
      await updatedPost.save();
    }

    return res.json({
      success: true,
      liked: false,
      likesCount:
        updatedPost?.likesCount ?? 0,
    });
  } catch (error) {
    return next(error);
  }
};

const getPostLikeStatus = async (
  req,
  res,
  next
) => {
  try {
    const { postId } = req.params;

    if (!mongoose.isValidObjectId(postId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid post ID.',
      });
    }

    const post = await ModelPost.findById(postId)
      .select('likesCount');

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found.',
      });
    }

    let liked = false;

    if (req.user?.type === 'client') {
      const existingLike =
        await ModelPostLike.exists({
          post: post._id,
          client: req.user.id,
        });

      liked = Boolean(existingLike);
    }

    return res.json({
      success: true,
      liked,
      likesCount: post.likesCount,
    });
  } catch (error) {
    return next(error);
  }
};

const getLikedPostIds = async (req, res) => {
  try {
    const likes = await ModelPostLike.find({
      clientId: req.user.id,
    }).select("postId -_id");

    const postIds = likes.map((like) => like.postId.toString());

    return res.status(200).json({
      success: true,
      data: postIds,
    });
  } catch (error) {
    console.error("Get liked post IDs error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get liked posts",
    });
  }
};

module.exports = {
  likePost,
  unlikePost,
  getPostLikeStatus,
  getLikedPostIds,
};