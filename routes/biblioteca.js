const express = require('express');
const pool = require('../db');
const validar = require('../middleware/validar');
const { requiereAutenticacion, requiereAdmin } = require('../middleware/auth');
const {
    libroSchema, ejemplarSchema, libroIdSchema, idParamSchema
} = require('../schemas/validaciones');

const router = express.Router();
router.use(requiereAutenticacion);   

const MAX_PRESTAMOS = 3;   
const DIAS_PRESTAMO = 7;  

const ESTADO_CALCULADO = `
    CASE WHEN p.estado = 'activo' AND p.fecha_vencimiento < now()
         THEN 'vencido' ELSE p.estado END`;

router.get('/libros', async (req, res, next) => {
    try {
        const r = await pool.query(
            `SELECT l.id, l.titulo, l.autor, l.isbn, l.categoria,
                    COUNT(e.id) FILTER (WHERE e.estado = 'disponible')::int AS disponibles
             FROM biblioteca.libros l
             LEFT JOIN biblioteca.ejemplares e ON e.libro_id = l.id
             GROUP BY l.id
             ORDER BY l.titulo`
        );
        res.json(r.rows);
    } catch (e) { next(e); }
});

router.post('/libros', requiereAdmin, validar(libroSchema), async (req, res, next) => {
    try {
        const { titulo, autor, isbn, categoria } = req.body;
        const r = await pool.query(
            `INSERT INTO biblioteca.libros (titulo, autor, isbn, categoria)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [titulo, autor, isbn || null, categoria || null]
        );
        res.status(201).json(r.rows[0]);
    } catch (e) { next(e); }
});

router.post('/ejemplares', requiereAdmin, validar(ejemplarSchema), async (req, res, next) => {
    try {
        const { libro_id, codigo } = req.body;
        const r = await pool.query(
            `INSERT INTO biblioteca.ejemplares (libro_id, codigo)
             VALUES ($1, $2) RETURNING *`,
            [libro_id, codigo]
        );
        res.status(201).json(r.rows[0]);
    } catch (e) { next(e); }
});

router.post('/prestamos', validar(libroIdSchema), async (req, res, next) => {
    const client = await pool.connect();
    try {
        const { libro_id } = req.body;
        await client.query('BEGIN');

        const activos = await client.query(
            `SELECT COUNT(*)::int AS n FROM biblioteca.prestamos
             WHERE usuario_id = $1 AND estado = 'activo'`,
            [req.cuenta.id]
        );
        if (activos.rows[0].n >= MAX_PRESTAMOS) {
            await client.query('ROLLBACK');
            return res.status(409).json({
                message: `Ya tienes ${MAX_PRESTAMOS} préstamos activos. Devuelve alguno primero.`
            });
        }

        const repetido = await client.query(
            `SELECT 1 FROM biblioteca.prestamos p
             JOIN biblioteca.ejemplares e ON e.id = p.ejemplar_id
             WHERE p.usuario_id = $1 AND e.libro_id = $2 AND p.estado = 'activo'`,
            [req.cuenta.id, libro_id]
        );
        if (repetido.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: 'Ya tienes prestado este libro.' });
        }

        const copia = await client.query(
            `SELECT id FROM biblioteca.ejemplares
             WHERE libro_id = $1 AND estado = 'disponible'
             LIMIT 1 FOR UPDATE SKIP LOCKED`,
            [libro_id]
        );
        if (copia.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({
                message: 'No hay copias disponibles. Puedes reservarlo.'
            });
        }

        await client.query(
            `UPDATE biblioteca.ejemplares SET estado = 'prestado' WHERE id = $1`,
            [copia.rows[0].id]
        );
        const prestamo = await client.query(
            `INSERT INTO biblioteca.prestamos (usuario_id, ejemplar_id, fecha_vencimiento)
             VALUES ($1, $2, now() + make_interval(days => $3)) RETURNING *`,
            [req.cuenta.id, copia.rows[0].id, DIAS_PRESTAMO]
        );

        await client.query(
            `UPDATE biblioteca.reservas SET estado = 'atendida'
             WHERE usuario_id = $1 AND libro_id = $2 AND estado = 'pendiente'`,
            [req.cuenta.id, libro_id]
        );

        await client.query('COMMIT');
        res.status(201).json(prestamo.rows[0]);
    } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        next(e);
    } finally {
        client.release();
    }
});

router.get('/prestamos/mios', async (req, res, next) => {
    try {
        const r = await pool.query(
            `SELECT p.id, l.titulo, p.fecha_prestamo, p.fecha_vencimiento,
                    p.fecha_devolucion, ${ESTADO_CALCULADO} AS estado
             FROM biblioteca.prestamos p
             JOIN biblioteca.ejemplares e ON e.id = p.ejemplar_id
             JOIN biblioteca.libros l ON l.id = e.libro_id
             WHERE p.usuario_id = $1
             ORDER BY p.fecha_prestamo DESC`,
            [req.cuenta.id]
        );
        res.json(r.rows);
    } catch (e) { next(e); }
});

router.get('/prestamos', requiereAdmin, async (req, res, next) => {
    try {
        const r = await pool.query(
            `SELECT p.id, u.usuario, l.titulo, e.codigo, p.fecha_vencimiento,
                    ${ESTADO_CALCULADO} AS estado
             FROM biblioteca.prestamos p
             JOIN public.usuarios u ON u.id = p.usuario_id
             JOIN biblioteca.ejemplares e ON e.id = p.ejemplar_id
             JOIN biblioteca.libros l ON l.id = e.libro_id
             WHERE p.estado = 'activo'
             ORDER BY p.fecha_vencimiento`
        );
        res.json(r.rows);
    } catch (e) { next(e); }
});

router.patch('/prestamos/:id/devolver', requiereAdmin, validar(idParamSchema, 'params'),
    async (req, res, next) => {
        try {
            const r = await pool.query(
                `WITH devuelto AS (
                     UPDATE biblioteca.prestamos
                     SET estado = 'devuelto', fecha_devolucion = now()
                     WHERE id = $1 AND estado = 'activo'
                     RETURNING ejemplar_id)
                 UPDATE biblioteca.ejemplares SET estado = 'disponible'
                 WHERE id = (SELECT ejemplar_id FROM devuelto)
                 RETURNING id`,
                [req.params.id]
            );
            if (r.rowCount === 0) {
                return res.status(404).json({ message: 'Préstamo activo no encontrado.' });
            }
            res.json({ message: 'Devolución registrada.' });
        } catch (e) { next(e); }
    }
);

router.post('/reservas', validar(libroIdSchema), async (req, res, next) => {
    try {
        const { libro_id } = req.body;

        const libro = await pool.query(
            `SELECT COUNT(e.id) FILTER (WHERE e.estado = 'disponible')::int AS disponibles
             FROM biblioteca.libros l
             LEFT JOIN biblioteca.ejemplares e ON e.libro_id = l.id
             WHERE l.id = $1
             GROUP BY l.id`,
            [libro_id]
        );
        if (libro.rows.length === 0) {
            return res.status(404).json({ message: 'Libro no encontrado.' });
        }
        if (libro.rows[0].disponibles > 0) {
            return res.status(409).json({
                message: 'Hay copias disponibles, pide el préstamo directamente.'
            });
        }

        const repetida = await pool.query(
            `SELECT 1 FROM biblioteca.reservas
             WHERE usuario_id = $1 AND libro_id = $2 AND estado = 'pendiente'`,
            [req.cuenta.id, libro_id]
        );
        if (repetida.rows.length > 0) {
            return res.status(409).json({ message: 'Ya tienes una reserva pendiente de este libro.' });
        }

        const r = await pool.query(
            `INSERT INTO biblioteca.reservas (usuario_id, libro_id)
             VALUES ($1, $2) RETURNING *`,
            [req.cuenta.id, libro_id]
        );
        res.status(201).json(r.rows[0]);
    } catch (e) { next(e); }
});

router.get('/reservas/mias', async (req, res, next) => {
    try {
        const r = await pool.query(
            `SELECT r.id, l.titulo, r.fecha_reserva, r.estado
             FROM biblioteca.reservas r
             JOIN biblioteca.libros l ON l.id = r.libro_id
             WHERE r.usuario_id = $1
             ORDER BY r.fecha_reserva DESC`,
            [req.cuenta.id]
        );
        res.json(r.rows);
    } catch (e) { next(e); }
});

router.patch('/reservas/:id/cancelar', validar(idParamSchema, 'params'),
    async (req, res, next) => {
        try {
            const r = await pool.query(
                `UPDATE biblioteca.reservas SET estado = 'cancelada'
                 WHERE id = $1 AND usuario_id = $2 AND estado = 'pendiente'
                 RETURNING id`,
                [req.params.id, req.cuenta.id]
            );
            if (r.rowCount === 0) {
                return res.status(404).json({ message: 'Reserva pendiente no encontrada.' });
            }
            res.json({ message: 'Reserva cancelada.' });
        } catch (e) { next(e); }
    }
);

module.exports = router;