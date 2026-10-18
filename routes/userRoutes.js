const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const authController = require('../controllers/authController');

// Ruta protegida /perfil: usa el middleware requireAuth para verificar la sesión antes de responder
router.get('/perfil', authMiddleware.requireAuth, authController.getProfile);

module.exports = router;
