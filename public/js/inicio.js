const saludo = document.getElementById('saludo');
const panelAdmin = document.getElementById('panelAdmin');
const mensajeInicio = document.getElementById('mensaje');

async function cargarInicio() {
    try {
        const response = await fetch('/api/auth/me', { credentials: 'same-origin' });

        if (response.status === 401) {
            window.location.replace('/');
            return;
        }

        const data = await response.json();
        saludo.textContent = `Hola, ${data.usuario.usuario}`;

        if (data.usuario.rol === 'admin') {
            panelAdmin.style.display = 'block';
        }
    } catch (error) {
        mensajeInicio.textContent = 'No se pudo cargar la página.';
        mensajeInicio.className = 'mensaje mensaje-error';
    }
}

document.getElementById('btnCerrarSesion').addEventListener('click', async () => {
    await fetch('/logout', { method: 'POST', credentials: 'same-origin' });
    window.location.replace('/');
});

cargarInicio();