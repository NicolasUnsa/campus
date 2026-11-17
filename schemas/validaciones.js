const { z } = require('zod');

const { limpiar } = require('../utils/sanitizar');

const textoSeguro = (min, max) =>
    z.string().trim().min(min).max(max).transform(limpiar);

// bcrypt solo usa los primeros 72 bytes
const passwordSchema = z
    .string()
    .min(1, 'La contraseña es obligatoria.')
    .refine(p => Buffer.byteLength(p, 'utf8') <= 72, 'La contraseña es demasiado larga.');

const loginSchema = z.object({
    usuario: z.string().trim().min(1, 'El usuario o correo es obligatorio.').max(100, 'Máximo 100 caracteres.'),
    password: passwordSchema
});

const CARRERAS = [
    'Administración', 'Agronomía', 'Antropología', 'Arquitectura',
    'Artes - Especialidad Música', 'Artes - Especialidad Plásticas','Banca y Seguros', 'Biología',
    'Ciencia de la Computación', 'Ciencias de la Comunicación - Periodismo',
    'Ciencias de la Comunicación - Relaciones Públicas', 'Ciencias de la Nutrición', 'Contabilidad', 'Derecho', 'Economía',
    'Educación - Ciencias Naturales', 'Educación - Ciencias Sociales', 'Educación - Educación Física', 'Educación - Educación Inicial',
    'Educación - Educación Primaria', 'Educación - Físico Matemática', 'Educación - Idiomas (Inglés - Francés)',
    'Educación - Informática Educativa', 'Educación - Lengua, Literatura, Filosofía y Psicología',
    'Enfermería', 'Filosofía', 'Finanzas', 'Física', 'Gestión - Gestión de Empresas',
    'Gestión - Gestión Pública','Historia', 'Ingeniería Ambiental', 'Ingeniería Civil',
    'Ingeniería de Industrias Alimentarias', 'Ingeniería de Materiales', 'Ingeniería de Minas',
    'Ingeniería de Sistemas', 'Ingeniería de Telecomunicaciones', 'Ingeniería Eléctrica',
    'Ingeniería Electrónica', 'Ingeniería Geofísica', 'Ingeniería Geológica', 'Ingeniería Industrial', 
    'Ingeniería Mecánica', 'Ingeniería Metalúrgica', 'Ingeniería Pesquera', 'Ingeniería Química', 'Ingeniería Sanitaria',
    'Literatura y Lingüística','Marketing', 'Matemáticas', 'Medicina', 'Psicología', 'Química',
    'Relaciones Industriales', 'Sociología', 'Trabajo Social', 'Turismo y Hotelería'
];

const registroSchema = z.object({
    nombres: textoSeguro(2, 80),
    apellidos: textoSeguro(2, 80),
    cui: z.string().trim().regex(/^\d{8}$/, 'El CUI debe tener exactamente 8 dígitos numéricos.'),
    carrera: z.enum(CARRERAS, 'Selecciona una carrera válida.'),
    usuario: z.string().trim()
        .min(3, 'El usuario debe tener al menos 3 caracteres.')
        .max(50, 'Máximo 50 caracteres.')
        .regex(/^[^@\s]+$/, 'El usuario no puede tener espacios ni @.'),
    correo: z.string().trim().toLowerCase().max(100, 'Máximo 100 caracteres.')
        .pipe(z.email('Correo no válido.')),
    password: passwordSchema.min(8, 'La contraseña debe tener al menos 8 caracteres.'),
    confirmarPassword: z.string()
}).refine(d => d.password === d.confirmarPassword, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmarPassword']
});

const estadoSchema = z.object({
    estado: z.enum(['activo', 'suspendido'], 'Estado no válido.')
});

const idParamSchema = z.object({
    id: z.coerce.number().int('El ID debe ser un entero.').positive('El ID debe ser positivo.')
});

// BIBLIOTECA
const libroSchema = z.object({
    titulo: textoSeguro(1, 200),
    autor: textoSeguro(1, 150),
    isbn: z.string().trim().max(20).optional(),
    categoria: textoSeguro(1, 80).optional()
});

const ejemplarSchema = z.object({
    libro_id: z.coerce.number().int().positive(),
    codigo: z.string().trim().min(1, 'El código es obligatorio.').max(50)
});

const libroIdSchema = z.object({
    libro_id: z.coerce.number().int().positive()
});

// ECONOMIA CIRCULAR
const publicacionSchema = z.object({
    titulo: textoSeguro(3, 150),
    descripcion: textoSeguro(0, 1000).optional(),
    categoria: textoSeguro(1, 80).optional(),
    tipo: z.enum(['venta', 'intercambio', 'donacion'], 'Tipo no válido.'),
    precio: z.coerce.number().nonnegative().max(99999).optional(),
    condicion: z.enum(['nuevo', 'bueno', 'usado']).optional()
}).refine(d => d.tipo !== 'venta' || d.precio !== undefined, {
    message: 'Una venta necesita precio.',
    path: ['precio']
});

const solicitudSchema = z.object({
    mensaje: textoSeguro(0, 500).optional()
});

const respuestaSchema = z.object({
    estado: z.enum(['aceptada', 'rechazada'], 'Estado no válido.')
});

const reporteSchema = z.object({
    motivo: textoSeguro(5, 500)
});

const calificacionSchema = z.object({
    puntaje: z.coerce.number().int().min(1, 'Mínimo 1.').max(5, 'Máximo 5.'),
    comentario: textoSeguro(0, 300).optional()
});

module.exports = {loginSchema, registroSchema, estadoSchema, idParamSchema, textoSeguro,
    libroSchema, ejemplarSchema, libroIdSchema, publicacionSchema, 
    solicitudSchema, respuestaSchema, reporteSchema, calificacionSchema
};