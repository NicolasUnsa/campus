require('dotenv').config();
const express = require('express');
const session = require('express-session');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET;

// Middleware para procesar body en JSON
app.use(express.json());

// Configuración de Sesiones con express-session
app.use(
    session({
        secret: SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true // Opcion de seguridad para proteger contra lecturas por JS en el cliente
        }
    })
);

// Logger en consola para peticiones entrantes
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Definición de las rutas
app.use('/api/auth', authRoutes);
app.use('/api', userRoutes);

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor Express ejecutándose en el puerto ${PORT}`);
});