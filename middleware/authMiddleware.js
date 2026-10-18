exports.requireAuth = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    }
    return res.status(401).json({
        status: 'fail',
        message: 'Acceso no autorizado'
    });
};