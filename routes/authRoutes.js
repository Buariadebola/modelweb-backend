const express = require('express');
const {
  registerClient,
  loginClient,
  loginAdmin,
  getCurrentUser,
} = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', registerClient);
router.post('/login', loginClient);
router.post('/admin/login', loginAdmin);
router.get('/me', authMiddleware, getCurrentUser);

module.exports = router;
