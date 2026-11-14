const tabla = document.getElementById('tablaUsuarios');
const mensajeAdmin = document.getElementById('mensaje');
let miId = null;

function mostrar(texto, tipo = '') {
    mensajeAdmin.textContent = texto;
    mensajeAdmin.className = `mensaje ${tipo}`;
}

async function solicitar(url, opciones = {}) {
    const response = await fetch(url, {
        credentials: 'same-origin',
        ...opciones,
        headers: {
            ...(opciones.body ? { 'Content-Type': 'application/json' } : {}),
            ...opciones.headers
        }
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 || response.status === 403) {
        window.location.replace('/');
        throw new Error('No tienes acceso.');
    }
    if (!response.ok) {
        throw new Error(data.errores?.[0]?.mensaje || data.message || 'Error en la solicitud.');
    }
    return data;
}

function crearBoton(texto, clase, accion) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `boton ${clase}`;
    b.textContent = texto;
    b.addEventListener('click', async () => {
        try {
            await accion();
        } catch (error) {
            mostrar(error.message, 'mensaje-error');
        }
    });
    return b;
}

async function cambiarEstado(id, estado) {
    await solicitar(`/api/admin/usuarios/${id}/estado`, {
        method: 'PATCH',
        body: JSON.stringify({ estado })
    });
    mostrar(`Cuenta ${estado === 'activo' ? 'activada' : 'suspendida'}.`, 'mensaje-exito');
    await cargarUsuarios();
}

async function eliminarUsuario(id, nombre) {
    if (!confirm(`¿Eliminar la cuenta de "${nombre}"? Esta acción no se puede deshacer.`)) return;
    await solicitar(`/api/admin/usuarios/${id}`, { method: 'DELETE' });
    mostrar('Cuenta eliminada.', 'mensaje-exito');
    await cargarUsuarios();
}

async function cargarUsuarios() {
    const usuarios = await solicitar('/api/admin/usuarios');
    tabla.replaceChildren();

    usuarios.forEach(u => {
        const fila = document.createElement('tr');

        [
            u.id,
            u.usuario,
            u.correo,
            u.rol,
            u.estado,
            new Date(u.fecha_creacion).toLocaleDateString('es-PE')
        ].forEach(valor => {
            const celda = document.createElement('td');
            celda.textContent = valor;
            fila.append(celda);
        });

        const acciones = document.createElement('td');
        if (u.id === miId) {
            acciones.textContent = '(tu cuenta)';
        } else {
            if (u.estado === 'activo') {
                acciones.append(crearBoton('Suspender', 'boton-secundario', () => cambiarEstado(u.id, 'suspendido')));
            } else {
                acciones.append(crearBoton('Activar', 'boton-secundario', () => cambiarEstado(u.id, 'activo')));
            }
            acciones.append(crearBoton('Eliminar', 'boton-peligro', () => eliminarUsuario(u.id, u.usuario)));
        }
        fila.append(acciones);
        tabla.append(fila);
    });
}

document.getElementById('btnCerrarSesion').addEventListener('click', async () => {
    await fetch('/logout', { method: 'POST', credentials: 'same-origin' });
    window.location.replace('/');
});

(async () => {
    try {
        const yo = await solicitar('/api/auth/me');
        miId = yo.usuario.id;
        await cargarUsuarios();
    } catch (error) {
        mostrar(error.message, 'mensaje-error');
    }
})();