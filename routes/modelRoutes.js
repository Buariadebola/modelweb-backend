const express = require('express');
const { getPublicModels, getPublicModelProfile, getPublicModelPosts, getDefaultModel } = require('../controllers/modelController');

const router = express.Router();

router.get('/', getPublicModels);
router.get('/default', getDefaultModel);
router.get('/:modelId/posts', getPublicModelPosts);
router.get('/:username', getPublicModelProfile);

module.exports = router;
