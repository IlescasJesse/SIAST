# Changelog

Versiones generadas automáticamente al hacer push (ver VERSIONADO.md). Las entradas anteriores al versionado automático (hasta la primera versión de abajo) son un resumen.

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
