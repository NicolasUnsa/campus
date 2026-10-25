const db = require('../db');

// GET /api/estudiantes  => listar todos
exports.getEstudiantes = async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM estudiantes ORDER BY id', []);
        res.status(200).json({ status: 'success', data: result.rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: 'fail', message: 'Error al obtener estudiantes' });
    }
};

// GET /api/estudiantes/:id  => obtener uno
exports.getEstudianteById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query('SELECT * FROM estudiantes WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ status: 'fail', message: 'Estudiante no encontrado' });
        }
        res.status(200).json({ status: 'success', data: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: 'fail', message: 'Error al obtener estudiante' });
    }
};

// POST /api/estudiantes  => crear
exports.createEstudiante = async (req, res) => {
    try {
        const { nombre, email, carrera } = req.body;

        if (!nombre || !email || !carrera) {
            return res.status(400).json({
                status: 'fail',
                message: 'Nombre, email y carrera son obligatorios'
            });
        }

        const result = await db.query(
            `INSERT INTO estudiantes (nombre, email, carrera)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [nombre, email, carrera]
        );

        res.status(201).json({
            status: 'success',
            message: 'Estudiante creado correctamente',
            data: result.rows[0]
        });
    } catch (error) {
        console.error(error);
        if (error.code === '23505') {
            return res.status(409).json({ status: 'fail', message: 'El email ya está registrado' });
        }
        res.status(500).json({ status: 'fail', message: 'Error al crear estudiante' });
    }
};

// PUT /api/estudiantes/:id  => actualizar
exports.updateEstudiante = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, email, carrera } = req.body;

        if (!nombre || !email || !carrera) {
            return res.status(400).json({
                status: 'fail',
                message: 'Nombre, email y carrera son obligatorios'
            });
        }

        const result = await db.query(
            `UPDATE estudiantes
             SET nombre = $1, email = $2, carrera = $3
             WHERE id = $4
             RETURNING *`,
            [nombre, email, carrera, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ status: 'fail', message: 'Estudiante no encontrado' });
        }

        res.status(200).json({
            status: 'success',
            message: 'Estudiante actualizado correctamente',
            data: result.rows[0]
        });
    } catch (error) {
        console.error(error);
        if (error.code === '23505') {
            return res.status(409).json({ status: 'fail', message: 'El email ya está registrado' });
        }
        res.status(500).json({ status: 'fail', message: 'Error al actualizar estudiante' });
    }
};

// DELETE /api/estudiantes/:id  => eliminar
exports.deleteEstudiante = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query(
            'DELETE FROM estudiantes WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ status: 'fail', message: 'Estudiante no encontrado' });
        }

        res.status(200).json({
            status: 'success',
            message: 'Estudiante eliminado correctamente',
            data: result.rows[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: 'fail', message: 'Error al eliminar estudiante' });
    }
};