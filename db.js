const readline = require('readline');
const bcrypt = require('bcryptjs');
const pool = require('./db');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function preguntar(texto) {
    return new Promise(resolve => rl.question(texto, resolve));
}

async function main() {
    try {
        const usuario = (await preguntar('Usuario: ')).trim();
        const password = await preguntar('Contraseña: ');

        if (!usuario || usuario.length > 100 || !password || Buffer.byteLength(password, 'utf8') > 72) {
            throw new Error('Usuario o contraseña inválidos.');
        }

        const hash = await bcrypt.hash(password, 12);

        await pool.query(
            `INSERT INTO usuarios (usuario, password_hash)
             VALUES ($1, $2)`,
            [usuario, hash]
        );

        console.log('Usuario creado correctamente.');
    } catch (error) {
        console.error('No se pudo crear el usuario:', error.message);
    } finally {
        rl.close();
        // Como db.js exporta el pool directamente, cerramos las conexiones con pool.end()
        await pool.end();
    }
}

main();