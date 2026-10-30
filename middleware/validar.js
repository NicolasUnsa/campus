const validar = (schema, origen = 'body') => (req, res, next) => {
    const resultado = schema.safeParse(req[origen] ?? {});

    if (!resultado.success) {
        return res.status(400).json({
            message: 'Datos inválidos.',
            errores: resultado.error.issues.map(i => ({
                campo: i.path.join('.'),
                mensaje: i.message
            }))
        });
    }

    // Reemplazamos por los datos ya limpios (trim, número, etc.)
    req[origen] = resultado.data;
    next();
};

module.exports = validar;