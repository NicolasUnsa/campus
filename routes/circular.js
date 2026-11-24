const express = require('express');
const pool = require('../db');
const validar = require('../middleware/validar');
const { requiereAutenticacion, requiereAdmin } = require('../middleware/auth');
const {
    publicacionSchema, solicitudSchema, respuestaSchema,
    reporteSchema, calificacionSchema, idParamSchema
} = require('../schemas/validaciones');

const router = express.Router();
router.use(requiereAutenticacion);  

router.get('/publicaciones', async (req, res, next) => {
    try {
        const r = await pool.query(
            `SELECT p.id, p.usuario_id, p.titulo, p.descripcion, p.categoria, p.tipo,
                    p.precio, p.condicion, p.imagen_url, p.fecha_publicacion,
                    u.usuario AS vendedor
             FROM circular.publicaciones p
             JOIN public.usuarios u ON u.id = p.usuario_id
             WHERE p.estado = 'disponible'
             ORDER BY p.fecha_publicacion DESC`
        );
        res.json(r.rows);
    } catch (e) { next(e); }
});

router.get('/publicaciones/mias', async (req, res, next) => {
    try {
        const r = await pool.query(
            `SELECT id, titulo, tipo, precio, estado, fecha_publicacion
             FROM circular.publicaciones
             WHERE usuario_id = $1
             ORDER BY fecha_publicacion DESC`,
            [req.cuenta.id]
        );
        res.json(r.rows);
    } catch (e) { next(e); }
});

router.post('/publicaciones', validar(publicacionSchema), async (req, res, next) => {
    try {
        const { titulo, descripcion, categoria, tipo, precio, condicion } = req.body;
        const r = await pool.query(
            `INSERT INTO circular.publicaciones
                 (usuario_id, titulo, descripcion, categoria, tipo, precio, condicion)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [
                req.cuenta.id, titulo, descripcion || null, categoria || null, tipo,
                tipo === 'venta' ? precio : null,
                condicion || null
            ]
        );
        res.status(201).json(r.rows[0]);
    } catch (e) { next(e); }
});

router.patch('/publicaciones/:id/entregar', validar(idParamSchema, 'params'),
    async (req, res, next) => {
        try {
            const r = await pool.query(
                `UPDATE circular.publicaciones SET estado = 'entregado'
                 WHERE id = $1 AND usuario_id = $2 AND estado = 'reservado'
                 RETURNING id`,
                [req.params.id, req.cuenta.id]
            );
            if (r.rowCount === 0) {
                return res.status(404).json({ message: 'Publicación reservada no encontrada.' });
            }
            res.json({ message: 'Marcada como entregada.' });
        } catch (e) { next(e); }
    }
);

router.delete('/publicaciones/:id', validar(idParamSchema, 'params'),
    async (req, res, next) => {
        try {
            const r = await pool.query(
                `DELETE FROM circular.publicaciones
                 WHERE id = $1 AND (usuario_id = $2 OR $3::text = 'admin')
                 RETURNING id`,
                [req.params.id, req.cuenta.id, req.cuenta.rol]
            );
            if (r.rowCount === 0) {
                return res.status(404).json({ message: 'Publicación no encontrada.' });
            }
            res.json({ message: 'Publicación eliminada.' });
        } catch (e) { next(e); }
    }
);

router.post('/publicaciones/:id/solicitudes',
    validar(idParamSchema, 'params'), validar(solicitudSchema),
    async (req, res, next) => {
        try {
            const pub = await pool.query(
                `SELECT usuario_id FROM circular.publicaciones
                 WHERE id = $1 AND estado = 'disponible'`,
                [req.params.id]
            );
            if (pub.rows.length === 0) {
                return res.status(404).json({ message: 'Publicación no disponible.' });
            }
            if (pub.rows[0].usuario_id === req.cuenta.id) {
                return res.status(400).json({ message: 'No puedes pedir tu propia publicación.' });
            }

            const r = await pool.query(
                `INSERT INTO circular.solicitudes (publicacion_id, solicitante_id, mensaje)
                 VALUES ($1, $2, $3) RETURNING *`,
                [req.params.id, req.cuenta.id, req.body.mensaje || null]
            );
            res.status(201).json(r.rows[0]);
        } catch (e) { next(e); }
    }
);

router.get('/solicitudes/recibidas', async (req, res, next) => {
    try {
        const r = await pool.query(
            `SELECT s.id, p.titulo, u.usuario AS solicitante, s.mensaje, s.estado, s.fecha
             FROM circular.solicitudes s
             JOIN circular.publicaciones p ON p.id = s.publicacion_id
             JOIN public.usuarios u ON u.id = s.solicitante_id
             WHERE p.usuario_id = $1
             ORDER BY s.fecha DESC`,
            [req.cuenta.id]
        );
        res.json(r.rows);
    } catch (e) { next(e); }
});

router.get('/solicitudes/enviadas', async (req, res, next) => {
    try {
        const r = await pool.query(
            `SELECT s.id, p.titulo, v.usuario AS vendedor, s.estado, s.fecha,
                    EXISTS (SELECT 1 FROM circular.calificaciones c
                            WHERE c.solicitud_id = s.id AND c.calificador_id = $1) AS calificada
             FROM circular.solicitudes s
             JOIN circular.publicaciones p ON p.id = s.publicacion_id
             JOIN public.usuarios v ON v.id = p.usuario_id
             WHERE s.solicitante_id = $1
             ORDER BY s.fecha DESC`,
            [req.cuenta.id]
        );
        res.json(r.rows);
    } catch (e) { next(e); }
});

router.patch('/solicitudes/:id', validar(idParamSchema, 'params'), validar(respuestaSchema),
    async (req, res, next) => {
        try {
            const r = await pool.query(
                `UPDATE circular.solicitudes s SET estado = $1
                 FROM circular.publicaciones p
                 WHERE s.id = $2 AND p.id = s.publicacion_id
                   AND p.usuario_id = $3 AND s.estado = 'pendiente'
                 RETURNING s.id, s.publicacion_id, s.estado`,
                [req.body.estado, req.params.id, req.cuenta.id]
            );
            if (r.rowCount === 0) {
                return res.status(404).json({ message: 'Solicitud pendiente no encontrada.' });
            }

            if (req.body.estado === 'aceptada') {
                const { publicacion_id } = r.rows[0];
                await pool.query(
                    `UPDATE circular.publicaciones SET estado = 'reservado' WHERE id = $1`,
                    [publicacion_id]
                );
                await pool.query(
                    `UPDATE circular.solicitudes SET estado = 'rechazada'
                     WHERE publicacion_id = $1 AND id <> $2 AND estado = 'pendiente'`,
                    [publicacion_id, req.params.id]
                );
            }
            res.json(r.rows[0]);
        } catch (e) { next(e); }
    }
);

router.post('/solicitudes/:id/calificar',
    validar(idParamSchema, 'params'), validar(calificacionSchema),
    async (req, res, next) => {
        try {
            const sol = await pool.query(
                `SELECT id FROM circular.solicitudes
                 WHERE id = $1 AND solicitante_id = $2 AND estado = 'aceptada'`,
                [req.params.id, req.cuenta.id]
            );
            if (sol.rows.length === 0) {
                return res.status(404).json({ message: 'Solicitud aceptada no encontrada.' });
            }

            const ya = await pool.query(
                `SELECT 1 FROM circular.calificaciones
                 WHERE solicitud_id = $1 AND calificador_id = $2`,
                [req.params.id, req.cuenta.id]
            );
            if (ya.rows.length > 0) {
                return res.status(409).json({ message: 'Ya calificaste esta solicitud.' });
            }

            const r = await pool.query(
                `INSERT INTO circular.calificaciones (solicitud_id, calificador_id, puntaje, comentario)
                 VALUES ($1, $2, $3, $4) RETURNING *`,
                [req.params.id, req.cuenta.id, req.body.puntaje, req.body.comentario || null]
            );
            res.status(201).json(r.rows[0]);
        } catch (e) { next(e); }
    }
);

router.post('/publicaciones/:id/reportes',
    validar(idParamSchema, 'params'), validar(reporteSchema),
    async (req, res, next) => {
        try {
            const pub = await pool.query(
                'SELECT usuario_id FROM circular.publicaciones WHERE id = $1',
                [req.params.id]
            );
            if (pub.rows.length === 0) {
                return res.status(404).json({ message: 'Publicación no encontrada.' });
            }
            if (pub.rows[0].usuario_id === req.cuenta.id) {
                return res.status(400).json({ message: 'No puedes reportar tu propia publicación.' });
            }

            await pool.query(
                `INSERT INTO circular.reportes (publicacion_id, reportado_por, motivo)
                 VALUES ($1, $2, $3)`,
                [req.params.id, req.cuenta.id, req.body.motivo]
            );
            res.status(201).json({ message: 'Reporte enviado. Gracias por avisar.' });
        } catch (e) { next(e); }
    }
);

router.get('/reportes', requiereAdmin, async (req, res, next) => {
    try {
        const r = await pool.query(
            `SELECT r.id, r.publicacion_id, p.titulo, u.usuario AS reportado_por, r.motivo
             FROM circular.reportes r
             JOIN circular.publicaciones p ON p.id = r.publicacion_id
             JOIN public.usuarios u ON u.id = r.reportado_por
             WHERE r.estado = 'abierto'
             ORDER BY r.id DESC`
        );
        res.json(r.rows);
    } catch (e) { next(e); }
});

router.patch('/reportes/:id/resolver', requiereAdmin, validar(idParamSchema, 'params'),
    async (req, res, next) => {
        try {
            const r = await pool.query(
                `UPDATE circular.reportes SET estado = 'resuelto'
                 WHERE id = $1 AND estado = 'abierto' RETURNING id`,
                [req.params.id]
            );
            if (r.rowCount === 0) {
                return res.status(404).json({ message: 'Reporte no encontrado.' });
            }
            res.json({ message: 'Reporte resuelto.' });
        } catch (e) { next(e); }
    }
);

module.exports = router;