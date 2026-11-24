const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();
const corsConfig = require('./middleware/corsConfig');
const { limiteGeneral, limiteLogin } = require('./middleware/limitadores');
const logger = require('./middleware/logger');
const pool = require('./db');
const validar = require('./middleware/validar');
const { requiereAutenticacion, requiereAdmin } = require('./middleware/auth');
const {
    loginSchema,
    registroSchema,
    estadoSchema,
    idParamSchema
} = require('./schemas/validaciones');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
app.set('trust proxy', 1);

// Opciones de la cookie que recuerda el último usuario
const COOKIE_ULTIMO_USUARIO = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    signed: true,
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 días
};
// --------------------------------------------------
// 1. CONFIGURACIÓN BÁSICA
// --------------------------------------------------
if (!process.env.SESSION_SECRET) {
    throw new Error('Falta SESSION_SECRET en las variables de entorno.');
}

// anota cada peticion en la terminal (ruta, resultado y tiempo)
app.use(logger); 

// permite quien puede acceder a nuestra api
app.use(corsConfig);

// limite general
app.use('/api', limiteGeneral)

// Comprime las respuestas (JSON, HTML, CSS, JS) con gzip/deflate.
app.use(compression({
    threshold: 1024 // solo comprime respuestas mayores a 1 KB
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Lee las cookies del navegador: req.cookies (normales)
// y req.signedCookies (firmadas con el mismo secreto de la sesión).
app.use(cookieParser(process.env.SESSION_SECRET));

app.use(session({
    name: 'gestion.sid',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 60 * 1000
    }
}));

// Publicamos únicamente los recursos estáticos.
app.use('/css', express.static(
    path.join(__dirname, 'public', 'css')
));
app.use('/js', express.static(
    path.join(__dirname, 'public', 'js')
));

// --------------------------------------------------
// 3. PÁGINAS WEB
// --------------------------------------------------
app.get('/', (req, res) => {
    res.sendFile(path.join(
        __dirname, 'public', 'index.html'
    ));
});

app.get('/registro.html', (req, res) => {
    res.sendFile(path.join(
        __dirname, 'public', 'registro.html'
    ));
});

app.get('/inicio.html', requiereAutenticacion, (req, res) => {
    res.sendFile(path.join(
        __dirname, 'public', 'inicio.html'
    ));
});

app.get('/admin.html', requiereAutenticacion, requiereAdmin, (req, res) => {
    res.sendFile(path.join(
        __dirname, 'public', 'admin.html'
    ));
});

app.get('/biblioteca.html', requiereAutenticacion, (req, res) => {
    res.sendFile(path.join(
        __dirname, 'public', 'biblioteca.html'
    ));
});

app.get('/circular.html', requiereAutenticacion, (req, res) => {
    res.sendFile(path.join(
        __dirname, 'public', 'circular.html'
    ));
});

// --------------------------------------------------
// 4. LOGIN (POST /login)
// --------------------------------------------------
app.post('/login', limiteLogin, validar(loginSchema), async (req, res, next) => {
    try {
        const { usuario, password } = req.body;

        const resultado = await pool.query(
            `SELECT id, usuario, contrasena, rol, estado
             FROM usuarios
             WHERE LOWER(usuario) = LOWER($1)
                OR LOWER(correo) = LOWER($1)`,
            [usuario]
        );

        if (resultado.rows.length === 0) {
            return res.status(401).json({ message: 'Credenciales incorrectas.' });
        }

        const cuenta = resultado.rows[0];
        const coincide = await bcrypt.compare(password, cuenta.contrasena);

        if (!coincide) {
            return res.status(401).json({ message: 'Credenciales incorrectas.' });
        }

        // La contraseña es correcta, ahora revisamos el estado de la cuenta
        if (cuenta.estado === 'suspendido') {
            return res.status(403).json({
                message: 'Tu cuenta está suspendida. Contacta a un administrador.'
            });
        }
        if (cuenta.estado !== 'activo') {
            return res.status(403).json({ message: 'Tu cuenta no está activa.' });
        }

        req.session.regenerate((error) => {
            if (error) return next(error);
            req.session.usuario = {
                id: cuenta.id,
                usuario: cuenta.usuario,
                rol: cuenta.rol
            };
            req.session.save((errorGuardar) => {
                if (errorGuardar) return next(errorGuardar);

                res.cookie('ultimo_usuario', cuenta.usuario, COOKIE_ULTIMO_USUARIO);

                return res.status(200).json({
                    message: 'Inicio de sesión correcto.',
                    usuario: {
                        id: cuenta.id,
                        usuario: cuenta.usuario,
                        rol: cuenta.rol
                    }
                });
            });
        });
    } catch (error) {
        next(error);
    }
});

app.post('/register', limiteLogin, validar(registroSchema), async (req, res, next) => {
    try {
        const { nombres, apellidos, cui, carrera, usuario, correo, password } = req.body;
        const passwordHash = await bcrypt.hash(password, 12);

        // rol = 'usuario' y estado = 'activo' los pone la base de datos por defecto
        const resultado = await pool.query(
            `INSERT INTO usuarios
             (usuario, correo, contrasena, nombres, apellidos, cui, carrera)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, usuario, correo`,
            [usuario, correo, passwordHash, nombres, apellidos, cui, carrera]
        );

        res.status(201).json({
            message: 'Cuenta creada correctamente.',
            usuario: resultado.rows[0]
        });
    } catch (error) {
        next(error);
    }
});

// --------------------------------------------------
// 5. VERIFICAR SESIÓN Y ÚLTIMO USUARIO
// --------------------------------------------------
app.get('/api/auth/me', requiereAutenticacion, (req, res) => {
    res.json({
        autenticado: true,
        usuario: req.cuenta
    });
});

// Devuelve el último usuario recordado (cookie firmada).
// Si la cookie fue alterada, signedCookies la ignora (queda en false).
app.get('/api/auth/ultimo-usuario', (req, res) => {
    const ultimo = req.signedCookies?.ultimo_usuario;
    res.json({
        usuario: typeof ultimo === 'string' ? ultimo : null
    });
});

// --------------------------------------------------
// 6. LOGOUT (POST /logout)
// --------------------------------------------------
app.post('/logout', (req, res, next) => {
    if (!req.session) {
        return res.status(200).json({
            message: 'Sesión cerrada.'
        });
    }
    req.session.destroy((error) => {
        if (error) return next(error);
        res.clearCookie('gestion.sid', {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            path: '/'
        });
        return res.status(200).json({
            message: 'Sesión cerrada correctamente.'
        });
    });
});

// --------------------------------------------------
// ADMINISTRACIÓN DE USUARIOS (solo admin)
// --------------------------------------------------
app.get('/api/admin/usuarios', requiereAutenticacion, requiereAdmin, async (req, res, next) => {
    try {
        const resultado = await pool.query(
            `SELECT id, usuario, correo, rol, estado, fecha_creacion
             FROM usuarios
             ORDER BY id`
        );
        res.json(resultado.rows);
    } catch (error) {
        next(error);
    }
});

app.patch(
    '/api/admin/usuarios/:id/estado',
    requiereAutenticacion,
    requiereAdmin,
    validar(idParamSchema, 'params'),
    validar(estadoSchema),
    async (req, res, next) => {
        try {
            const { id } = req.params;
            const { estado } = req.body;

            if (id === req.cuenta.id) {
                return res.status(400).json({
                    message: 'No puedes cambiar el estado de tu propia cuenta.'
                });
            }

            const resultado = await pool.query(
                `UPDATE usuarios SET estado = $1 WHERE id = $2
                 RETURNING id, usuario, correo, rol, estado`,
                [estado, id]
            );
            if (resultado.rows.length === 0) {
                return res.status(404).json({ message: 'Usuario no encontrado.' });
            }
            res.json(resultado.rows[0]);
        } catch (error) {
            next(error);
        }
    }
);

app.delete(
    '/api/admin/usuarios/:id',
    requiereAutenticacion,
    requiereAdmin,
    validar(idParamSchema, 'params'),
    async (req, res, next) => {
        try {
            const { id } = req.params;

            if (id === req.cuenta.id) {
                return res.status(400).json({
                    message: 'No puedes eliminar tu propia cuenta.'
                });
            }

            const resultado = await pool.query(
                'DELETE FROM usuarios WHERE id = $1 RETURNING id, usuario',
                [id]
            );
            if (resultado.rows.length === 0) {
                return res.status(404).json({ message: 'Usuario no encontrado.' });
            }
            res.json({ message: 'Usuario eliminado correctamente.' });
        } catch (error) {
            next(error);
        }
    }
);


// SERVICIOS (cada uno con su propio router)
app.use('/api/biblioteca', require('./routes/biblioteca'));
app.use('/api/circular', require('./routes/circular'));

// --------------------------------------------------
// 8. MANEJO CENTRALIZADO DE ERRORES
// --------------------------------------------------
app.use((error, req, res, next) => {
    console.error(error);
    if (res.headersSent) {
        return next(error);
    }
    if (error.code === '23505') {
        let mensaje = 'Ya existe un registro con esos datos.';
        if (error.constraint?.includes('cui')) {
            mensaje = 'Ese CUI ya está registrado.';
        } else if (error.table === 'usuarios') {
            mensaje = 'Ya existe un registro con ese usuario o correo.';
        }
        return res.status(409).json({ message: mensaje });
    }
    
    if (error.code === '23503') {
        return res.status(409).json({
            message: 'No se puede completar: hay datos relacionados que lo impiden (por ejemplo, préstamos registrados).'
        });
    }
    return res.status(500).json({
        message: 'Ocurrió un error interno del servidor.'
    });
});

// --------------------------------------------------
// 9. INICIO DEL SERVIDOR
// --------------------------------------------------
async function iniciarServidor() {
    try {
        await pool.query('SELECT 1');
        app.listen(PORT, () => {
            console.log(`Servidor: http://localhost:${PORT}`);
            console.log('Conexión a PostgreSQL verificada.');
        });
    } catch (error) {
        console.error('No se pudo conectar a PostgreSQL:', error.message);
        process.exit(1);
    }
}

iniciarServidor();