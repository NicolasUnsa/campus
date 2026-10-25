document.addEventListener('DOMContentLoaded', () => {
    const formLogin = document.getElementById('formLogin');
    const mensajeLogin = document.getElementById('mensaje') || document.getElementById('message');

    function mostrarMensaje(texto, tipo = '') {
        if (mensajeLogin) {
            mensajeLogin.textContent = texto;
            mensajeLogin.className = `mensaje ${tipo}`;
        }
    }

    if (formLogin) {
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value.trim();

            if (!email || !password) {
                mostrarMensaje('Por favor, complete todos los campos.', 'mensaje-error');
                return;
            }

            try {
                const response = await fetch('/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, password }),
                    credentials: 'same-origin'
                });

                const data = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(data.message || data.error || 'Credenciales inválidas.');
                }

                // Redireccionar al panel CRUD de estudiantes tras un login exitoso
                window.location.replace('/estudiantes.html');
            } catch (error) {
                mostrarMensaje(error.message, 'mensaje-error');
            }
        });
    }
});