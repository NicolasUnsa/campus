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

const registroSchema = z.object({
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

module.exports = { loginSchema, registroSchema, estadoSchema, idParamSchema, textoSeguro };