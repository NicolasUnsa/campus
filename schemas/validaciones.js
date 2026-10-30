const { z } = require('zod');

// bcrypt solo usa los primeros 72 bytes
const passwordSchema = z
    .string()
    .min(1, 'La contraseña es obligatoria.')
    .refine(p => Buffer.byteLength(p, 'utf8') <= 72, 'La contraseña es demasiado larga.');

const loginSchema = z.object({
    usuario: z.string().trim().min(1, 'El usuario es obligatorio.').max(100, 'Máximo 100 caracteres.'),
    password: passwordSchema
});

const estudianteSchema = z.object({
    nombre: z.string().trim().min(1, 'El nombre es obligatorio.').max(100, 'Máximo 100 caracteres.'),
    email: z.string().trim().max(100, 'Máximo 100 caracteres.').pipe(z.email('Correo no válido.')),
    carrera: z.string().trim().min(1, 'La carrera es obligatoria.').max(80, 'Máximo 80 caracteres.')
});

const idParamSchema = z.object({
    id: z.coerce.number().int('El ID debe ser un entero.').positive('El ID debe ser positivo.')
});

module.exports = { loginSchema, estudianteSchema, idParamSchema };