const formulario = document.getElementById('formEstudiante');
const tabla = document.getElementById('studentTableBody');
const mensajeEstudiantes = document.getElementById('message');
const btnGuardar = document.getElementById('saveButton');
const btnCancelar = document.getElementById('cancelButton');

function mensaje(texto, tipo = '') {
    mensajeEstudiantes.textContent = texto;
    mensajeEstudiantes.className = `mensaje ${tipo}`;
}

async function solicitar(url, opciones = {}) {
    const response = await fetch(url, {
        credentials: 'same-origin',
        ...opciones,
        headers: {
            ...(opciones.body
                ? { 'Content-Type': 'application/json' }
                : {}),
            ...opciones.headers
        }
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
        window.location.replace('/');
        throw new Error('La sesión ha expirado.');
    }
    if (!response.ok) {
        throw new Error(data.message || data.error ||
            'Error al procesar la solicitud.');
    }
    return data;
}

async function cargarEstudiantes() {
    try {
        const estudiantes = await solicitar('/api/estudiantes');
        tabla.replaceChildren();
        if (estudiantes.length === 0) {
            const fila = document.createElement('tr');
            const celda = document.createElement('td');
            celda.colSpan = 6;
            celda.textContent = 'No hay estudiantes registrados.';
            fila.append(celda);
            tabla.append(fila);
            return;
        }
        estudiantes.forEach(estudiante => {
            const fila = document.createElement('tr');
            
            // Columnas según tu HTML: ID, Nombre, Email, Carrera, Creado
            [
                estudiante.id, 
                estudiante.nombre,
                estudiante.email, 
                estudiante.carrera,
                estudiante.creado_en ? new Date(estudiante.creado_en).toLocaleString() : ''
            ].forEach(valor => {
                const celda = document.createElement('td');
                celda.textContent = String(valor ?? '');
                fila.append(celda);
            });

            const acciones = document.createElement('td');
            acciones.className = 'acciones';
            
            const editar = document.createElement('button');
            editar.textContent = 'Editar';
            editar.className = 'boton boton-secundario';
            editar.type = 'button';
            editar.addEventListener('click', () => {
                prepararEdicion(estudiante);
            });

            const eliminar = document.createElement('button');
            eliminar.textContent = 'Eliminar';
            eliminar.className = 'boton boton-peligro';
            eliminar.type = 'button';
            eliminar.addEventListener('click', () => {
                eliminarEstudiante(estudiante.id);
            });

            acciones.append(editar, eliminar);
            fila.append(acciones);
            tabla.append(fila);
        });
    } catch (error) {
        mensaje(error.message, 'mensaje-error');
    }
}

function prepararEdicion(estudiante) {
    document.getElementById('studentId').value = estudiante.id;
    document.getElementById('nombre').value = estudiante.nombre;
    document.getElementById('email').value = estudiante.email;
    document.getElementById('carrera').value = estudiante.carrera;
    btnGuardar.textContent = 'Actualizar estudiante';
    btnCancelar.style.display = 'inline-block';
    btnCancelar.hidden = false;
    formulario.scrollIntoView({ behavior: 'smooth' });
}

function limpiarFormulario() {
    formulario.reset();
    document.getElementById('studentId').value = '';
    btnGuardar.textContent = 'Registrar estudiante';
    btnCancelar.style.display = 'none';
    btnCancelar.hidden = true;
}

btnCancelar.addEventListener('click', limpiarFormulario);

formulario.addEventListener('submit', async event => {
    event.preventDefault();
    const id = document.getElementById('studentId').value;
    const estudiante = {
        nombre: document.getElementById('nombre').value.trim(),
        email: document.getElementById('email').value.trim(),
        carrera: document.getElementById('carrera').value.trim()
    };

    if (!estudiante.nombre || !estudiante.email ||
        !estudiante.carrera) {
        mensaje('Todos los campos son obligatorios.', 'mensaje-error');
        return;
    }

    const editando = Boolean(id);
    btnGuardar.disabled = true;

    try {
        await solicitar(
            editando ? `/api/estudiantes/${id}` : '/api/estudiantes',
            {
                method: editando ? 'PUT' : 'POST',
                body: JSON.stringify(estudiante)
            }
        );
        mensaje(
            editando ? 'Estudiante actualizado.' :
                'Estudiante registrado.',
            'mensaje-exito'
        );
        limpiarFormulario();
        await cargarEstudiantes();
    } catch (error) {
        mensaje(error.message, 'mensaje-error');
    } finally {
        btnGuardar.disabled = false;
    }
});

async function eliminarEstudiante(id) {
    if (!confirm('¿Desea eliminar este estudiante?')) return;
    try {
        await solicitar(`/api/estudiantes/${id}`, {
            method: 'DELETE'
        });
        mensaje('Estudiante eliminado.', 'mensaje-exito');
        await cargarEstudiantes();
    } catch (error) {
        mensaje(error.message, 'mensaje-error');
    }
}

const btnCerrar = document.getElementById('btnCerrarSesion');
if (btnCerrar) {
    btnCerrar.addEventListener('click', async () => {
        try {
            await solicitar('/logout', { method: 'POST' });
            window.location.replace('/');
        } catch (error) {
            mensaje(error.message, 'mensaje-error');
        }
    });
}

const btnRefresh = document.getElementById('refreshButton');
if (btnRefresh) {
    btnRefresh.addEventListener('click', cargarEstudiantes);
}

cargarEstudiantes();