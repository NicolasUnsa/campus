const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { getProfile } = require('../controllers/authController');

router.get('/perfil', authMiddleware.requireAuth, getProfile);

module.exports = router;