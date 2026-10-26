const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const controller = require('../controllers/estudiantesController');

router.use(auth);

router.get('/', controller.getEstudiantes);
router.get('/:id', controller.getEstudianteById);
router.post('/', controller.createEstudiante);
router.put('/:id', controller.updateEstudiante);
router.delete('/:id', controller.deleteEstudiante);

module.exports = router;