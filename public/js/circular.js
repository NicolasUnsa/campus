let miId = null;
let esAdmin = false;
let publicaciones = [];

const listaPub = document.getElementById('listaPublicaciones');
const buscadorPub = document.getElementById('buscarPub');
const filtroTipo = document.getElementById('filtroTipo');
const cuerpoMias = document.getElementById('tablaMias');
const cuerpoRecibidas = document.getElementById('tablaRecibidas');
const cuerpoEnviadas = document.getElementById('tablaEnviadas');
const cuerpoReportes = document.getElementById('tablaReportes');

const NOMBRE_TIPO = { venta: 'Venta', intercambio: 'Intercambio', donacion: 'Donación' };

function textoPrecio(p) {
    if (p.tipo === 'venta') return `S/ ${Number(p.precio).toFixed(2)}`;
    if (p.tipo === 'donacion') return 'Gratis';
    return 'A cambio de otro material';
}

function crearTarjeta(p) {
    const tarjeta = document.createElement('article');
    tarjeta.className = 'publicacion';

    const etiqueta = document.createElement('span');
    etiqueta.className = `etiqueta etiqueta-${p.tipo}`;
    etiqueta.textContent = NOMBRE_TIPO[p.tipo];

    const titulo = document.createElement('h3');
    titulo.textContent = p.titulo;

    const precio = document.createElement('p');
    precio.className = 'precio';
    precio.textContent = textoPrecio(p);

    const detalle = document.createElement('p');
    detalle.className = 'detalle';
    detalle.textContent = `Por ${p.vendedor} · ${p.categoria || 'Sin categoría'} · ${p.condicion || 'condición sin especificar'}`;

    tarjeta.append(etiqueta, titulo, precio, detalle);

    if (p.descripcion) {
        const descripcion = document.createElement('p');
        descripcion.textContent = p.descripcion;
        tarjeta.append(descripcion);
    }

    const acciones = document.createElement('div');
    acciones.className = 'acciones';

    if (p.usuario_id === miId) {
        const propia = document.createElement('span');
        propia.className = 'detalle';
        propia.textContent = '(tu publicación)';
        acciones.append(propia);
    } else {
        acciones.append(
            crearBoton('Solicitar', '', () => solicitarMaterial(p.id)),
            crearBoton('Reportar', 'boton-secundario', () => reportarMaterial(p.id))
        );
    }

    tarjeta.append(acciones);
    return tarjeta;
}

function pintarPublicaciones() {
    const texto = buscadorPub.value.trim().toLowerCase();
    const tipo = filtroTipo.value;
    const lista = publicaciones.filter(p =>
        (!tipo || p.tipo === tipo) &&
        `${p.titulo} ${p.categoria ?? ''} ${p.descripcion ?? ''}`.toLowerCase().includes(texto)
    );

    listaPub.replaceChildren();
    if (lista.length === 0) {
        const vacio = document.createElement('p');
        vacio.className = 'texto-secundario';
        vacio.textContent = 'No hay materiales disponibles con esos filtros.';
        listaPub.append(vacio);
        return;
    }
    lista.forEach(p => listaPub.append(crearTarjeta(p)));
}

async function cargarPublicaciones() {
    publicaciones = await solicitar('/api/circular/publicaciones');
    pintarPublicaciones();
}

async function solicitarMaterial(id) {
    const mensaje = prompt('Mensaje para el vendedor (opcional):');
    if (mensaje === null) return;
    const cuerpo = {};
    if (mensaje.trim()) cuerpo.mensaje = mensaje.trim();

    await solicitar(`/api/circular/publicaciones/${id}/solicitudes`, {
        method: 'POST',
        body: JSON.stringify(cuerpo)
    });
    mostrar('Solicitud enviada. El dueño te responderá pronto.', 'mensaje-exito');
    await cargarEnviadas();
}

async function reportarMaterial(id) {
    const motivo = prompt('¿Por qué reportas esta publicación? (mínimo 5 caracteres)');
    if (motivo === null) return;

    const r = await solicitar(`/api/circular/publicaciones/${id}/reportes`, {
        method: 'POST',
        body: JSON.stringify({ motivo })
    });
    mostrar(r.message, 'mensaje-exito');
    if (esAdmin) await cargarReportes();
}

async function cargarMias() {
    const lista = await solicitar('/api/circular/publicaciones/mias');
    cuerpoMias.replaceChildren();
    if (lista.length === 0) {
        cuerpoMias.append(filaVacia(5, 'Aún no has publicado nada.'));
        return;
    }
    lista.forEach(p => {
        const botones = [];
        if (p.estado === 'reservado') {
            botones.push(crearBoton('Marcar entregado', 'boton-secundario', async () => {
                await solicitar(`/api/circular/publicaciones/${p.id}/entregar`, { method: 'PATCH' });
                mostrar('Marcada como entregada.', 'mensaje-exito');
                await recargarTodo();
            }));
        }
        botones.push(crearBoton('Eliminar', 'boton-peligro', async () => {
            if (!confirm(`¿Eliminar "${p.titulo}"?`)) return;
            await solicitar(`/api/circular/publicaciones/${p.id}`, { method: 'DELETE' });
            mostrar('Publicación eliminada.', 'mensaje-exito');
            await recargarTodo();
        }));
        cuerpoMias.append(fila(
            [p.titulo, NOMBRE_TIPO[p.tipo], p.estado, formatoFecha(p.fecha_publicacion)],
            botones
        ));
    });
}

async function responder(id, estado) {
    await solicitar(`/api/circular/solicitudes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ estado })
    });
    mostrar(`Solicitud ${estado}.`, 'mensaje-exito');
    await recargarTodo();
}

async function cargarRecibidas() {
    const lista = await solicitar('/api/circular/solicitudes/recibidas');
    cuerpoRecibidas.replaceChildren();
    if (lista.length === 0) {
        cuerpoRecibidas.append(filaVacia(5, 'No has recibido solicitudes.'));
        return;
    }
    lista.forEach(s => {
        const botones = [];
        if (s.estado === 'pendiente') {
            botones.push(
                crearBoton('Aceptar', '', () => responder(s.id, 'aceptada')),
                crearBoton('Rechazar', 'boton-peligro', () => responder(s.id, 'rechazada'))
            );
        }
        cuerpoRecibidas.append(fila(
            [s.titulo, s.solicitante, s.mensaje || '-', s.estado],
            botones
        ));
    });
}

async function calificar(id) {
    const entrada = prompt('Califica al vendedor del 1 al 5:');
    if (entrada === null) return;

    await solicitar(`/api/circular/solicitudes/${id}/calificar`, {
        method: 'POST',
        body: JSON.stringify({ puntaje: entrada })
    });
    mostrar('Gracias por tu calificación.', 'mensaje-exito');
    await cargarEnviadas();
}

async function cargarEnviadas() {
    const lista = await solicitar('/api/circular/solicitudes/enviadas');
    cuerpoEnviadas.replaceChildren();
    if (lista.length === 0) {
        cuerpoEnviadas.append(filaVacia(5, 'No has enviado solicitudes.'));
        return;
    }
    lista.forEach(s => {
        const botones = [];
        if (s.estado === 'aceptada' && !s.calificada) {
            botones.push(crearBoton('Calificar', 'boton-secundario', () => calificar(s.id)));
        }
        cuerpoEnviadas.append(fila(
            [s.titulo, s.vendedor, formatoFecha(s.fecha), s.estado],
            botones
        ));
    });
}

async function cargarReportes() {
    const lista = await solicitar('/api/circular/reportes');
    cuerpoReportes.replaceChildren();
    if (lista.length === 0) {
        cuerpoReportes.append(filaVacia(4, 'No hay reportes abiertos.'));
        return;
    }
    lista.forEach(r => {
        const resolver = crearBoton('Marcar resuelto', 'boton-secundario', async () => {
            await solicitar(`/api/circular/reportes/${r.id}/resolver`, { method: 'PATCH' });
            mostrar('Reporte resuelto.', 'mensaje-exito');
            await cargarReportes();
        });
        const borrar = crearBoton('Eliminar publicación', 'boton-peligro', async () => {
            if (!confirm(`¿Eliminar la publicación "${r.titulo}"?`)) return;
            await solicitar(`/api/circular/publicaciones/${r.publicacion_id}`, { method: 'DELETE' });
            mostrar('Publicación eliminada.', 'mensaje-exito');
            await recargarTodo();
        });
        cuerpoReportes.append(fila([r.titulo, r.reportado_por, r.motivo], [resolver, borrar]));
    });
}

const campoPrecio = document.getElementById('campoPrecio');
const selectTipo = document.getElementById('pubTipo');

function actualizarCampoPrecio() {
    campoPrecio.hidden = selectTipo.value !== 'venta';
}
selectTipo.addEventListener('change', actualizarCampoPrecio);
actualizarCampoPrecio();

document.getElementById('formPublicacion').addEventListener('submit', async (evento) => {
    evento.preventDefault();

    const cuerpo = {
        titulo: document.getElementById('pubTitulo').value,
        tipo: selectTipo.value
    };
    const descripcion = document.getElementById('pubDescripcion').value.trim();
    const categoria = document.getElementById('pubCategoria').value.trim();
    const condicion = document.getElementById('pubCondicion').value;
    const precio = document.getElementById('pubPrecio').value;

    if (descripcion) cuerpo.descripcion = descripcion;
    if (categoria) cuerpo.categoria = categoria;
    if (condicion) cuerpo.condicion = condicion;
    if (cuerpo.tipo === 'venta' && precio !== '') cuerpo.precio = precio;

    try {
        await solicitar('/api/circular/publicaciones', {
            method: 'POST',
            body: JSON.stringify(cuerpo)
        });
        evento.target.reset();
        actualizarCampoPrecio();
        mostrar('Material publicado.', 'mensaje-exito');
        await Promise.all([cargarPublicaciones(), cargarMias()]);
    } catch (error) {
        mostrar(error.message, 'mensaje-error');
    }
});

buscadorPub.addEventListener('input', pintarPublicaciones);
filtroTipo.addEventListener('change', pintarPublicaciones);

async function recargarTodo() {
    await Promise.all([cargarPublicaciones(), cargarMias(), cargarRecibidas(), cargarEnviadas()]);
    if (esAdmin) await cargarReportes();
}

(async () => {
    try {
        const yo = await solicitar('/api/auth/me');
        miId = yo.usuario.id;
        esAdmin = yo.usuario.rol === 'admin';
        document.getElementById('panelAdmin').hidden = !esAdmin;
        await recargarTodo();
    } catch (error) {
        mostrar(error.message, 'mensaje-error');
    }
})();