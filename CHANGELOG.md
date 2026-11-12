# Changelog

Versiones generadas automáticamente al hacer push (ver VERSIONADO.md). Las entradas anteriores al versionado automático (hasta la primera versión de abajo) son un resumen.

## v1.4.1 — 2026-11-12 · ARREGLO

- Permitir seleccionar otra área en Mapa de Áreas; bloquear solo con cambios sin guardar — Jesse Ilescas (`151ebb9`)

## v1.4.0 — 2026-11-11 · MENOR

- Enfocar el área levantada en Solicitudes y bloquear las demás al editar en Mapa de Áreas — Jesse Ilescas (`5a36cb0`)

## v1.3.2 — 2026-11-11 · ARREGLO

- Forzar que el visor 3D se recargue al salir una versión nueva — Jesse Ilescas (`7278006`)

## v1.3.1 — 2026-11-11 · ARREGLO

- Corregir clic en un área del piso 2 que mandaba al piso 4 en el Mapa de Áreas — Jesse Ilescas (`5869f0b`)

## v1.3.0 — 2026-11-11 · MENOR

- Agregar prompt del monitor del servidor para avisos y novedades — Jesse Ilescas (`7bbf39b`)
- Ocultar el trabajo de los Admin en Métricas para quien no es Admin — Jesse Ilescas (`f225ac6`)
- Permitir que Admin y Mesa de Ayuda asignen solicitudes y pasos a un Admin — Jesse Ilescas (`4054753`)

## v1.2.0 — 2026-11-11 · MENOR

- Agregar horario de disponibilidad, ubicación con búsqueda y área levantada en Solicitudes — Jesse Ilescas (`d81a447`)
- Agregar vista cenital, etiquetas ocultables y área levantada al visor 3D y Mapa de Áreas — Jesse Ilescas (`f46217d`)

## v1.1.2 — 2026-11-09 · ARREGLO

- Mapa de áreas: la cámara no se mueve al seleccionar/editar y se empieza sin pendientes viejos — Jesse Ilescas (`082f572`)

## v1.1.1 — 2026-11-06 · ARREGLO

- Conservar la vista de la cámara al activar Dibujar área en el mapa de áreas — Jesse Ilescas (`a53bbed`)
- Forzar mayúsculas en el formulario de nueva área del mapa de áreas — Jesse Ilescas (`e4498f0`)

## v1.1.0 — 2026-11-03 · MENOR

- Agregar pruebas unitarias de la API con node:test — Jesse Ilescas (`5e7e72a`)
- Validar sesión en salas de tiempo real y ocultar comentarios internos al solicitante — Jesse Ilescas (`6c9f033`)
- Avisos de mantenimiento y ventana de novedades del sistema — Jesse Ilescas (`f87565b`)
- Mostrar extensión, ubicación y contacto del solicitante en el detalle de la solicitud — Jesse Ilescas (`000dc41`)
- Contar en métricas las solicitudes que resuelven Admin, Mesa de Ayuda y Responsables — Jesse Ilescas (`9b9d1ef`)
- Dibujar áreas como polígonos en el Mapa de Áreas y el visor 3D — Jesse Ilescas (`0f24e4d`)
- Adjuntar capturas y documentos a solicitudes y comentarios — Jesse Ilescas (`a226eb2`)
- Corregir lectura de empleado del SIRH: elegir el registro correcto del arreglo — Jesse Ilescas (`03326cb`)

## v1.0.2 — 2026-10-13 · ARREGLO

- Corregir visor 3D en el servidor: pedir las áreas por el mismo dominio en vez del puerto 5101 — Jesse Ilescas (`d99838a`)

## v1.0.1 — 2026-10-13 · ARREGLO

- Corregir Mapa de Áreas: mostrar en el visor 3D las áreas agregadas o dibujadas — Jesse Ilescas (`9184ad0`)

## v1.0.0 — 2026-10-12

Primera versión numerada (180 commits desde el 2026-03-25):

- Mesa de ayuda: tickets con folio, reasignación entre áreas, prioridad manual, límite de 4 tickets activos por empleado y bloqueo de solicitudes repetitivas
- Acceso de empleados por RFC con OTP y de staff con usuario y contraseña; bloqueo progresivo de IP
- Sincronización de empleados y adscripciones con SIRH (cuenta de servicio `SIAST-SERVICE`)
- Visor 3D del edificio y editor de áreas con adscripción SIRH; vista para tablet
- Organigrama, métricas de productividad, recursos, personal por honorarios y subtipos de Sistemas
