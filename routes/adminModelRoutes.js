const express = require('express');
const {
  createModel,
  listModelsAdmin,
  getAdminModelDetails,
  updateModel,
  updateProfileImage,
} = require('../controllers/modelController');
const {
  createModelPost,
  updateModelPost,
  deleteModelPost,
} = require('../controllers/modelPostController');
const authMiddleware = require('../middleware/authMiddleware');
const requireAdmin = require('../middleware/adminMiddleware');
const { profileImageUpload, mediaUpload } = require('../middleware/uploadMiddleware');

const router = express.Router();

router.use(authMiddleware);
router.use(requireAdmin);

router.get('/', listModelsAdmin);
router.post('/', profileImageUpload, createModel);
router.get('/:modelId', getAdminModelDetails);
router.put('/:modelId', updateModel);
router.put('/:modelId/profile-image', profileImageUpload, updateProfileImage);
router.post('/:modelId/posts', mediaUpload, createModelPost);
router.put('/:modelId/posts/:postId', mediaUpload, updateModelPost);
router.delete('/:modelId/posts/:postId', deleteModelPost);

module.exports = router;
