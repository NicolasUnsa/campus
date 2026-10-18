
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Rutas públicas de autenticación
router.post('/register', authController.register);
router.post('/login', authController.login);

// Ruta de cierre de sesión
router.post('/logout', authController.logout);

module.exports = router;