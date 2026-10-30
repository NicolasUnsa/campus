document.addEventListener('DOMContentLoaded', () => {
    const formLogin = document.getElementById('formLogin');
    const mensajeLogin = document.getElementById('mensaje');

    function mostrarMensaje(texto, tipo = '') {
        if (mensajeLogin) {
            mensajeLogin.textContent = texto;
            mensajeLogin.className = `mensaje ${tipo}`;
        }
    }

    // Rellena el campo usuario con el último usuario recordado (cookie firmada)
    async function cargarUltimoUsuario() {
        const usuarioInput = document.getElementById('usuario');
        const passwordInput = document.getElementById('password');
        if (!usuarioInput) return;

        try {
            const response = await fetch('/api/auth/ultimo-usuario', {
                credentials: 'same-origin'
            });
            if (!response.ok) return;

            const data = await response.json();
            if (data.usuario) {
                usuarioInput.value = data.usuario;
                if (passwordInput) passwordInput.focus();
            }
        } catch (error) {
            // Si falla, simplemente no se rellena el campo
        }
    }

    if (formLogin) {
        cargarUltimoUsuario();

        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();

            const usuarioInput = document.getElementById('usuario');
            const passwordInput = document.getElementById('password');

            if (!usuarioInput || !passwordInput) {
                mostrarMensaje('Error en los campos del formulario.', 'mensaje-error');
                return;
            }

            const usuario = usuarioInput.value.trim();
            const password = passwordInput.value;

            if (!usuario || !password) {
                mostrarMensaje('Por favor, complete todos los campos.', 'mensaje-error');
                return;
            }

            try {
                const response = await fetch('/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ usuario, password }),
                    credentials: 'same-origin'
                });

                const data = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(
                        data.errores?.[0]?.mensaje ||
                        data.message ||
                        data.error ||
                        'Credenciales inválidas.'
                    );
                }

                // Redireccionar al panel CRUD de estudiantes tras un login exitoso
                window.location.replace('/estudiantes.html');
            } catch (error) {
                mostrarMensaje(error.message, 'mensaje-error');
            }
        });
    }
});