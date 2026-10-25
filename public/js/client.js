const API_URL = '/api/estudiantes';

// ELEMENTOS HTML
const form = document.getElementById('studentForm');
const studentId = document.getElementById('studentId');
const nombre = document.getElementById('nombre');
const email = document.getElementById('email');
const carrera = document.getElementById('carrera');
const tableBody = document.getElementById('studentTableBody');
const message = document.getElementById('message');
const formTitle = document.getElementById('formTitle');
const saveButton = document.getElementById('saveButton');
const cancelButton = document.getElementById('cancelButton');
const refreshButton = document.getElementById('refreshButton');

// MOSTRAR MENSAJE
function mostrarMensaje(texto, tipo) {
    message.textContent = texto;
    message.className = tipo;
}

// CARGAR ESTUDIANTES (GET)
async function cargarEstudiantes() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) {
            throw new Error('Error al obtener estudiantes');
        }
        const result = await response.json();
        mostrarEstudiantes(result.data);
    } catch (error) {
        console.error(error);
        mostrarMensaje(error.message, 'error');
    }
}

// MOSTRAR TABLA
function mostrarEstudiantes(estudiantes) {
    tableBody.innerHTML = '';
    estudiantes.forEach(estudiante => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${estudiante.id}</td>
            <td>${estudiante.nombre}</td>
            <td>${estudiante.email}</td>
            <td>${estudiante.carrera}</td>
            <td>${new Date(estudiante.creado_en).toLocaleString()}</td>
            <td>
                <button onclick="editarEstudiante(${estudiante.id})">
                    Editar
                </button>
                <button onclick="eliminarEstudiante(${estudiante.id})" class="danger">
                    Eliminar
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// REGISTRAR / ACTUALIZAR (POST / PUT)
form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = {
        nombre: nombre.value.trim(),
        email: email.value.trim(),
        carrera: carrera.value.trim()
    };
    try {
        let response;
        if (studentId.value) {
            // ---------- ACTUALIZAR ----------
            response = await fetch(`${API_URL}/${studentId.value}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else {
            // ---------- CREAR ----------
            response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || 'Error en la operación');
        }
        mostrarMensaje(result.message, 'success');
        limpiarFormulario();
        await cargarEstudiantes();
    } catch (error) {
        console.error(error);
        mostrarMensaje(error.message, 'error');
    }
});

// EDITAR
async function editarEstudiante(id) {
    try {
        const response = await fetch(`${API_URL}/${id}`);
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message);
        }
        const estudiante = result.data;
        studentId.value = estudiante.id;
        nombre.value = estudiante.nombre;
        email.value = estudiante.email;
        carrera.value = estudiante.carrera;
        formTitle.textContent = 'Editar estudiante';
        saveButton.textContent = 'Actualizar estudiante';
        cancelButton.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
        console.error(error);
        mostrarMensaje(error.message, 'error');
    }
}

// ELIMINAR (DELETE)
async function eliminarEstudiante(id) {
    const confirmar = confirm('¿Está seguro de eliminar este estudiante?');
    if (!confirmar) {
        return;
    }
    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message);
        }
        mostrarMensaje(result.message, 'success');
        await cargarEstudiantes();
    } catch (error) {
        console.error(error);
        mostrarMensaje(error.message, 'error');
    }
}

// LIMPIAR FORMULARIO
function limpiarFormulario() {
    form.reset();
    studentId.value = '';
    formTitle.textContent = 'Registrar estudiante';
    saveButton.textContent = 'Registrar estudiante';
    cancelButton.style.display = 'none';
}

// BOTONES CANCELAR Y ACTUALIZAR
cancelButton.addEventListener('click', limpiarFormulario);
refreshButton.addEventListener('click', cargarEstudiantes);

// INICIALIZACIÓN: cargar la lista al abrir la página
cargarEstudiantes();