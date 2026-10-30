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
const {
    loginSchema,
    estudianteSchema,
    idParamSchema
} = require('./schemas/validaciones');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

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
    throw new Error('Falta SESSION_SECRET en el archivo .env');
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
// 2. MIDDLEWARE DE AUTENTICACIÓN
// --------------------------------------------------
function requiereAutenticacion(req, res, next) {
    if (req.session && req.session.usuario) {
        return next();
    }
    return res.status(401).json({
        message: 'Debe iniciar sesión para continuar.'
    });
}

// --------------------------------------------------
// 3. PÁGINAS WEB
// --------------------------------------------------
app.get('/', (req, res) => {
    res.sendFile(path.join(
        __dirname, 'public', 'index.html'
    ));
});

app.get('/estudiantes.html', requiereAutenticacion, (req, res) => {
    res.sendFile(path.join(
        __dirname, 'public', 'estudiantes.html'
    ));
});

// --------------------------------------------------
// 4. LOGIN (POST /login)
// --------------------------------------------------
app.post('/login', limiteLogin, validar(loginSchema), async (req, res, next) => {
    try {
        const { usuario, password } = req.body;

        const resultado = await pool.query(
            `SELECT id, usuario, password_hash
             FROM usuarios
             WHERE LOWER(usuario) = LOWER($1)
               AND activo = TRUE`,
            [usuario]
        );

        if (resultado.rows.length === 0) {
            return res.status(401).json({
                message: 'Credenciales incorrectas.'
            });
        }

        const cuenta = resultado.rows[0];
        const coincide = await bcrypt.compare(
            password,
            cuenta.password_hash
        );

        if (!coincide) {
            return res.status(401).json({
                message: 'Credenciales incorrectas.'
            });
        }

        req.session.regenerate((error) => {
            if (error) return next(error);
            req.session.usuario = {
                id: cuenta.id,
                usuario: cuenta.usuario
            };
            req.session.save((errorGuardar) => {
                if (errorGuardar) return next(errorGuardar);

                // Recordamos solo el nombre de usuario (nunca la contraseña)
                res.cookie(
                    'ultimo_usuario',
                    cuenta.usuario,
                    COOKIE_ULTIMO_USUARIO
                );

                return res.status(200).json({
                    message: 'Inicio de sesión correcto.',
                    usuario: {
                        id: cuenta.id,
                        usuario: cuenta.usuario
                    }
                });
            });
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
        usuario: req.session.usuario
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
// 7. CRUD DE ESTUDIANTES (Protegidos)
// --------------------------------------------------

// GET /api/estudiantes
app.get('/api/estudiantes', requiereAutenticacion, async (req, res, next) => {
    try {
        const resultado = await pool.query(
            `SELECT id, nombre, email, carrera, creado_en
             FROM estudiantes
             ORDER BY id`
        );
        res.json(resultado.rows);
    } catch (error) {
        next(error);
    }
});

// GET /api/estudiantes/:id
app.get(
    '/api/estudiantes/:id',
    requiereAutenticacion,
    validar(idParamSchema, 'params'),
    async (req, res, next) => {
        try {
            const { id } = req.params;
            const resultado = await pool.query(
                `SELECT id, nombre, email, carrera, creado_en
                 FROM estudiantes
                 WHERE id = $1`,
                [id]
            );
            if (resultado.rows.length === 0) {
                return res.status(404).json({
                    message: 'Estudiante no encontrado.'
                });
            }
            res.json(resultado.rows[0]);
        } catch (error) {
            next(error);
        }
    }
);

// POST /api/estudiantes
app.post(
    '/api/estudiantes',
    requiereAutenticacion,
    validar(estudianteSchema),
    async (req, res, next) => {
        try {
            const { nombre, email, carrera } = req.body;
            const resultado = await pool.query(
                `INSERT INTO estudiantes (nombre, email, carrera)
                 VALUES ($1, $2, $3)
                 RETURNING id, nombre, email, carrera, creado_en`,
                [nombre, email, carrera]
            );
            res.status(201).json(resultado.rows[0]);
        } catch (error) {
            next(error);
        }
    }
);

// PUT /api/estudiantes/:id
app.put(
    '/api/estudiantes/:id',
    requiereAutenticacion,
    validar(idParamSchema, 'params'),
    validar(estudianteSchema),
    async (req, res, next) => {
        try {
            const { id } = req.params;
            const { nombre, email, carrera } = req.body;
            const resultado = await pool.query(
                `UPDATE estudiantes
                 SET nombre = $1, email = $2, carrera = $3
                 WHERE id = $4
                 RETURNING id, nombre, email, carrera, creado_en`,
                [nombre, email, carrera, id]
            );
            if (resultado.rows.length === 0) {
                return res.status(404).json({
                    message: 'Estudiante no encontrado.'
                });
            }
            res.json(resultado.rows[0]);
        } catch (error) {
            next(error);
        }
    }
);

// DELETE /api/estudiantes/:id
app.delete(
    '/api/estudiantes/:id',
    requiereAutenticacion,
    validar(idParamSchema, 'params'),
    async (req, res, next) => {
        try {
            const { id } = req.params;
            const resultado = await pool.query(
                `DELETE FROM estudiantes
                 WHERE id = $1
                 RETURNING id, nombre, email, carrera`,
                [id]
            );
            if (resultado.rows.length === 0) {
                return res.status(404).json({
                    message: 'Estudiante no encontrado.'
                });
            }
            res.json({
                message: 'Estudiante eliminado correctamente.',
                estudiante: resultado.rows[0]
            });
        } catch (error) {
            next(error);
        }
    }
);

// --------------------------------------------------
// 8. MANEJO CENTRALIZADO DE ERRORES
// --------------------------------------------------
app.use((error, req, res, next) => {
    console.error(error);
    if (res.headersSent) {
        return next(error);
    }
    if (error.code === '23505') {
        return res.status(409).json({
            message: 'Ya existe un registro con ese usuario o correo.'
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