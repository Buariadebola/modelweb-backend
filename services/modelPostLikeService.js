const ModelPost = require('../models/ModelPost');

const AUTO_LIKE_INTERVAL = 12 * 60 * 60 * 1000;

const getRandomAutoLikeAmount = () => {
  return Math.random() < 0.5 ? 7 : 8;
};

const addAutomaticLikesToPost = async (post) => {
  const now = new Date();

  // New post: give it its first automatic batch.
  if (!post.lastAutoLikeAt) {
    const amount = getRandomAutoLikeAmount();

    post.likesCount += amount;
    post.autoLikesCount += amount;
    post.lastAutoLikeAt = now;

    await post.save();

    return amount;
  }

  const elapsed =
    now.getTime() -
    new Date(post.lastAutoLikeAt).getTime();

  if (elapsed < AUTO_LIKE_INTERVAL) {
    return 0;
  }

  // Calculate how many 12-hour periods have passed.
  const intervalsPassed = Math.floor(
    elapsed / AUTO_LIKE_INTERVAL
  );

  let totalAdded = 0;

  for (let i = 0; i < intervalsPassed; i += 1) {
    totalAdded += getRandomAutoLikeAmount();
  }

  if (totalAdded <= 0) {
    return 0;
  }

  post.likesCount += totalAdded;
  post.autoLikesCount += totalAdded;

  // Move the timestamp forward by complete intervals.
  post.lastAutoLikeAt = new Date(
    new Date(post.lastAutoLikeAt).getTime() +
      intervalsPassed * AUTO_LIKE_INTERVAL
  );

  await post.save();

  return totalAdded;
};

const processAutomaticPostLikes = async () => {
  try {
    const posts = await ModelPost.find({
      isPublished: true,
    });

    let processedPosts = 0;
    let totalLikesAdded = 0;

    for (const post of posts) {
      const added =
        await addAutomaticLikesToPost(post);

      if (added > 0) {
        processedPosts += 1;
        totalLikesAdded += added;
      }
    }

    if (totalLikesAdded > 0) {
      console.log(
        `[AUTO LIKES] Added ${totalLikesAdded} likes across ${processedPosts} post(s).`
      );
    }

    return {
      processedPosts,
      totalLikesAdded,
    };
  } catch (error) {
    console.error(
      '[AUTO LIKES] Failed:',
      error.message
    );

    return {
      processedPosts: 0,
      totalLikesAdded: 0,
    };
  }
};

const startAutomaticPostLikes = () => {
  // Process once when the server starts.
  processAutomaticPostLikes();

  // Check every hour.
  // Each post itself determines whether its 12-hour
  // interval has actually passed.
  const timer = setInterval(
    () => {
      processAutomaticPostLikes();
    },
    60 * 60 * 1000
  );

  return timer;
};

module.exports = {
  AUTO_LIKE_INTERVAL,
  getRandomAutoLikeAmount,
  addAutomaticLikesToPost,
  processAutomaticPostLikes,
  startAutomaticPostLikes,
};