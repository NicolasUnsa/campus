exports.requireAuth = (req, res, next) => {
    // Verifica si la sesión existe y tiene un userId asignado
    if (req.session && req.session.userId) {
        return next();
    }

    return res.status(401).json({
        status: 'fail',
        message: 'Acceso no autorizado'
    });
};