const elementoMensaje = document.getElementById('mensaje');

function mostrar(texto, tipo = '') {
    elementoMensaje.textContent = texto;
    elementoMensaje.className = `mensaje ${tipo}`;
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

    if (response.status === 401) {
        window.location.replace('/');
        throw new Error('Debes iniciar sesión.');
    }
    if (!response.ok) {
        throw new Error(data.errores?.[0]?.mensaje || data.message || 'Error en la solicitud.');
    }
    return data;
}

function crearBoton(texto, clase, accion) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `boton ${clase}`.trim();
    b.textContent = texto;
    b.addEventListener('click', async () => {
        b.disabled = true;
        try {
            await accion();
        } catch (error) {
            mostrar(error.message, 'mensaje-error');
        } finally {
            b.disabled = false;
        }
    });
    return b;
}

// Crea una fila <tr> con celdas de texto y, opcionalmente, una celda de botones
function fila(valores, botones) {
    const tr = document.createElement('tr');
    valores.forEach(valor => {
        const td = document.createElement('td');
        td.textContent = valor ?? '';
        tr.append(td);
    });
    if (botones) {
        const td = document.createElement('td');
        td.append(...botones);
        tr.append(td);
    }
    return tr;
}

function filaVacia(columnas, texto) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = columnas;
    td.textContent = texto;
    tr.append(td);
    return tr;
}

function formatoFecha(valor) {
    return valor ? new Date(valor).toLocaleDateString('es-PE') : '-';
}

document.getElementById('btnCerrarSesion')?.addEventListener('click', async () => {
    await fetch('/logout', { method: 'POST', credentials: 'same-origin' });
    window.location.replace('/');
});