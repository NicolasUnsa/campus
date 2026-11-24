const pool = require('../db');
// --------------------------------------------------
// 2. MIDDLEWARE DE AUTENTICACIÓN
// --------------------------------------------------
async function requiereAutenticacion(req, res, next) {
    try {
        if (!req.session || !req.session.usuario) {
            return res.status(401).json({
                message: 'Debe iniciar sesión para continuar.'
            });
        }

        const resultado = await pool.query(
            'SELECT id, usuario, rol, estado FROM usuarios WHERE id = $1',
            [req.session.usuario.id]
        );
        const cuenta = resultado.rows[0];

        if (!cuenta || cuenta.estado !== 'activo') {
            return req.session.destroy(() => {
                res.status(401).json({ message: 'Tu cuenta no está activa.' });
            });
        }

        req.cuenta = cuenta;
        next();
    } catch (error) {
        next(error);
    }
}

function requiereAdmin(req, res, next) {
    if (req.cuenta?.rol !== 'admin') {
        return res.status(403).json({
            message: 'Solo los administradores pueden hacer esto.'
        });
    }
    next();
}

module.exports = { requiereAutenticacion, requiereAdmin };