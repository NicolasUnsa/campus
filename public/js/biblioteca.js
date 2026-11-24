let catalogo = [];
let esAdmin = false;

const cuerpoCatalogo = document.getElementById('tablaCatalogo');
const cuerpoPrestamos = document.getElementById('tablaPrestamos');
const cuerpoReservas = document.getElementById('tablaReservas');
const cuerpoPrestamosAdmin = document.getElementById('tablaPrestamosAdmin');
const buscadorLibros = document.getElementById('buscarLibro');
const selectLibros = document.getElementById('ejemplarLibro');

function pintarCatalogo() {
    const texto = buscadorLibros.value.trim().toLowerCase();
    const lista = catalogo.filter(l =>
        `${l.titulo} ${l.autor} ${l.categoria ?? ''}`.toLowerCase().includes(texto)
    );

    cuerpoCatalogo.replaceChildren();
    if (lista.length === 0) {
        cuerpoCatalogo.append(filaVacia(5, 'No hay libros para mostrar.'));
        return;
    }

    lista.forEach(l => {
        const boton = l.disponibles > 0
            ? crearBoton('Pedir prestado', '', () => pedirPrestamo(l.id))
            : crearBoton('Reservar', 'boton-secundario', () => reservar(l.id));
        cuerpoCatalogo.append(
            fila([l.titulo, l.autor, l.categoria || '-', l.disponibles], [boton])
        );
    });
}

async function cargarCatalogo() {
    catalogo = await solicitar('/api/biblioteca/libros');
    pintarCatalogo();

    selectLibros.replaceChildren();
    catalogo.forEach(l => {
        const opcion = document.createElement('option');
        opcion.value = l.id;
        opcion.textContent = l.titulo;
        selectLibros.append(opcion);
    });
}

async function pedirPrestamo(libroId) {
    await solicitar('/api/biblioteca/prestamos', {
        method: 'POST',
        body: JSON.stringify({ libro_id: libroId })
    });
    mostrar('Préstamo registrado. Tienes 7 días para devolverlo.', 'mensaje-exito');
    await recargarTodo();
}

async function reservar(libroId) {
    await solicitar('/api/biblioteca/reservas', {
        method: 'POST',
        body: JSON.stringify({ libro_id: libroId })
    });
    mostrar('Reserva registrada.', 'mensaje-exito');
    await cargarMisReservas();
}

async function cargarMisPrestamos() {
    const prestamos = await solicitar('/api/biblioteca/prestamos/mios');
    cuerpoPrestamos.replaceChildren();
    if (prestamos.length === 0) {
        cuerpoPrestamos.append(filaVacia(4, 'Aún no tienes préstamos.'));
        return;
    }
    prestamos.forEach(p => {
        cuerpoPrestamos.append(fila([
            p.titulo,
            formatoFecha(p.fecha_prestamo),
            formatoFecha(p.fecha_vencimiento),
            p.estado
        ]));
    });
}

async function cargarMisReservas() {
    const reservas = await solicitar('/api/biblioteca/reservas/mias');
    cuerpoReservas.replaceChildren();
    if (reservas.length === 0) {
        cuerpoReservas.append(filaVacia(4, 'No tienes reservas.'));
        return;
    }
    reservas.forEach(r => {
        const botones = [];
        if (r.estado === 'pendiente') {
            botones.push(crearBoton('Cancelar', 'boton-peligro', async () => {
                await solicitar(`/api/biblioteca/reservas/${r.id}/cancelar`, { method: 'PATCH' });
                mostrar('Reserva cancelada.', 'mensaje-exito');
                await cargarMisReservas();
            }));
        }
        cuerpoReservas.append(fila([r.titulo, formatoFecha(r.fecha_reserva), r.estado], botones));
    });
}

async function cargarPrestamosAdmin() {
    const prestamos = await solicitar('/api/biblioteca/prestamos');
    cuerpoPrestamosAdmin.replaceChildren();
    if (prestamos.length === 0) {
        cuerpoPrestamosAdmin.append(filaVacia(6, 'No hay préstamos pendientes de devolución.'));
        return;
    }
    prestamos.forEach(p => {
        const boton = crearBoton('Registrar devolución', 'boton-secundario', async () => {
            await solicitar(`/api/biblioteca/prestamos/${p.id}/devolver`, { method: 'PATCH' });
            mostrar('Devolución registrada.', 'mensaje-exito');
            await recargarTodo();
        });
        cuerpoPrestamosAdmin.append(fila([
            p.usuario, p.titulo, p.codigo, formatoFecha(p.fecha_vencimiento), p.estado
        ], [boton]));
    });
}

document.getElementById('formLibro').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const cuerpo = {
        titulo: document.getElementById('libroTitulo').value,
        autor: document.getElementById('libroAutor').value
    };
    const isbn = document.getElementById('libroIsbn').value.trim();
    const categoria = document.getElementById('libroCategoria').value.trim();
    if (isbn) cuerpo.isbn = isbn;
    if (categoria) cuerpo.categoria = categoria;

    try {
        await solicitar('/api/biblioteca/libros', {
            method: 'POST',
            body: JSON.stringify(cuerpo)
        });
        evento.target.reset();
        mostrar('Libro agregado al catálogo.', 'mensaje-exito');
        await cargarCatalogo();
    } catch (error) {
        mostrar(error.message, 'mensaje-error');
    }
});

document.getElementById('formEjemplar').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    try {
        await solicitar('/api/biblioteca/ejemplares', {
            method: 'POST',
            body: JSON.stringify({
                libro_id: selectLibros.value,
                codigo: document.getElementById('ejemplarCodigo').value
            })
        });
        document.getElementById('ejemplarCodigo').value = '';
        mostrar('Copia registrada.', 'mensaje-exito');
        await cargarCatalogo();
    } catch (error) {
        mostrar(error.message, 'mensaje-error');
    }
});

buscadorLibros.addEventListener('input', pintarCatalogo);

async function recargarTodo() {
    await Promise.all([cargarCatalogo(), cargarMisPrestamos(), cargarMisReservas()]);
    if (esAdmin) await cargarPrestamosAdmin();
}

(async () => {
    try {
        const yo = await solicitar('/api/auth/me');
        esAdmin = yo.usuario.rol === 'admin';
        document.getElementById('panelAdmin').hidden = !esAdmin;
        await recargarTodo();
    } catch (error) {
        mostrar(error.message, 'mensaje-error');
    }
})();