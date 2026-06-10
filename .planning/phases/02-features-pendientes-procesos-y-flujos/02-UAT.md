---
status: complete
phase: 02-features-pendientes-procesos-y-flujos
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md, 02-04-SUMMARY.md]
started: 2026-05-12T00:00:00Z
updated: 2026-05-13T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Detén cualquier servidor corriendo. Arranca la API desde cero con `npm run dev:api`. El servidor debe iniciar sin errores. Ejecuta `npm run db:seed` en packages/database — debe completar exitosamente mostrando "Seed completado exitosamente". Una llamada básica como GET /api/health (o cualquier endpoint activo) debe responder con datos reales.
result: pass

### 2. Ticket SIRH abre con paso de soporte TI
expected: Crea un ticket con subcategoría SISTEMAS_INSTITUCIONALES y subTipo SIRH (o desde el frontend, la categoría correspondiente). El ticket se crea correctamente. En el detalle del ticket debe aparecer 1 paso llamado "Atención por Soporte TI" con rol requerido TECNICO_TI y estado PENDIENTE.
result: pass
note: "Issue encontrado y corregido durante UAT — selector SIRH/SIAST agregado. Paso 'Atención por Soporte TI' visible en detalle de ticket."

### 3. Ticket SIAST abre con paso de soporte TI
expected: Crea un ticket con subcategoría SISTEMAS_INSTITUCIONALES y subTipo SIAST. El ticket se crea correctamente con 1 paso "Atención por Soporte TI". El flujo es idéntico al de SIRH — misma estructura de paso.
result: pass

### 4. Técnico lista tickets sin RESUELTO/CANCELADO por defecto
expected: Autentícate como técnico TI. Consulta GET /api/tickets (sin parámetro ?estado). La respuesta NO debe incluir tickets con estado RESUELTO ni CANCELADO. Si pasas explícitamente ?estado=RESUELTO, sí deben aparecer los resueltos.
result: pass

### 5. Asignar técnico directo bloqueado en ticket con pasos
expected: Con un ticket SIRH o SIAST que ya tiene pasos creados, llama al endpoint de asignar técnico directamente (PUT/PATCH asignarTicket). La API debe responder con error 400 y mensaje "Este ticket usa flujo de pasos. Asignar técnico desde el panel de pasos."
result: pass

### 6. Resolver ticket con pasos pendientes bloqueado
expected: Con un ticket SIRH/SIAST cuyo paso está en PENDIENTE o EN_PROGRESO, intenta cambiar el estado a RESUELTO (PUT cambiarEstado). La API debe responder con error 400 y mensaje "El ticket tiene pasos pendientes. Completa todos los pasos para resolver."
result: pass
note: "Guard funciona. UX del flujo de pasos (asignar/completar/estado) reportada como confusa/ambigua — ver backlog."

### 7. Solo técnico asignado puede completar su paso
expected: Asigna el paso de un ticket a un técnico específico. Luego intenta completar ese paso autenticado como un técnico diferente con el mismo rol. La API debe responder con 403 "Solo el técnico asignado puede completar este paso". Si el paso no tiene técnico asignado (tecnicoId null), cualquier técnico con rol correcto puede completarlo.
result: issue
reported: "No pudo cambiar el estado pero decía error 400, no 403"
severity: minor

### 8. Solo asignador puede cerrar ticket + encuesta de calidad
expected: |
  Técnicos solo completan sus pasos asignados — no cierran el ticket.
  Solo quien asignó el ticket (MESA_AYUDA/ADMIN) puede marcarlo como RESUELTO.
  Al cerrarlo, el sistema lanza encuesta de satisfacción al empleado y al técnico.
  Encuesta genera métricas de satisfacción en dashboard.
result: issue
reported: "Diseño incorrecto — técnico no debe auto-resolver. Solo asignador cierra. Falta encuesta de calidad al cerrar."
severity: major

### 9. Métricas de procesos muestran nombres desde DB
expected: Accede al dashboard de métricas (como ADMIN o MESA_AYUDA). En la sección de métricas por proceso, los procesos SIRH y SIAST deben aparecer con nombres "Soporte SIRH" y "Soporte SIAST" respectivamente — nombres que vienen de ProcesoDefinicion en DB, no de un mapa hardcodeado.
result: issue
reported: "Solo aparece 'Tecnologías' — sección de SIRH/SIAST no visible. Métricas poco legibles, faltan gráficas de índice resolución/cancelación."
severity: major

### 10. Monorepo compila sin errores TypeScript
expected: Desde la raíz del proyecto, ejecuta `npx tsc --noEmit -p packages/shared/tsconfig.json`, luego `-p packages/database/tsconfig.json`, luego `-p apps/api/tsconfig.json`. Los tres deben completar sin errores (salida vacía = éxito). No debe existir ningún import de PROCESO_MAP, getProcesoKey ni getProcesoInfo en apps/.
result: pass

## Summary

total: 10
passed: 7
issues: 3
pending: 0
fixed_during_uat: 5
skipped: 0
blocked: 0

## Gaps

- truth: "Formulario muestra selector de subTipo para SISTEMAS_INSTITUCIONALES (SIRH/SIAST)"
  status: fixed
  reason: "User reported: formulario no homogéneo — sistemas no mostraba selector, solo asunto directo"
  severity: major
  test: 2
  root_cause: "SolicitudNewPage.jsx solo tenía condicional para EQUIPOS_DISPOSITIVOS. SUB_TIPO_SISTEMAS y SUB_TIPO_RED no importados. CUENTAS_DOMINIO sin auto-set."
  fix: "Agregado condicional SISTEMAS_INSTITUCIONALES (required) + RED_INTERNET (opcional, shrink+notched) + auto-set CUENTAS_DOMINIO. Constantes en @stf/shared."

- truth: "Formulario EQUIPO_AUDIOVISUAL y SALA_JUNTAS muestra disponibilidad real desde DB"
  status: backlog
  reason: "User requested: vincular inventario real recursos materiales, checkboxes con disponiblesCount, disabled si 0"
  severity: major
  root_cause: "CatalogoRecurso sin campo subcategoria. Endpoint requiere rol GESTOR. Necesita migration + nuevo endpoint + frontend."
  missing:
    - "Migración: agregar subcategoria nullable a CatalogoRecurso"
    - "Endpoint GET /api/recursos/disponibles-para-solicitud?subcategoria=X (cualquier user auth)"
    - "Seed: vincular catálogos existentes a subcategoría"
    - "Frontend: checkboxes disponiblesCount, disabled si 0, aviso sin stock"

- truth: "EMPLEADO no puede navegar a /solicitudes (lista general de tickets)"
  status: fixed
  reason: "User reported: empleado que sabe la ruta puede acceder a /solicitudes"
  severity: major
  root_cause: "Ruta /solicitudes sin guardia de rol en App.jsx. Backend sí filtra (solo tickets del RFC), pero UI es staff-oriented y confusa para EMPLEADO. ProtectedRoute redirigía a /solicitudes — loop potencial."
  fix: "Agregado ProtectedRoute con roles staff en /solicitudes. ProtectedRoute redirect cambiado de /solicitudes a / (RootRedirect maneja por rol)."

- truth: "Guard de paso incorrecto retorna 403 (no 400) cuando técnico diferente intenta completar paso ajeno"
  status: failed
  reason: "User reported: no pudo cambiar el estado pero decía error 400, no 403"
  severity: minor
  test: 7
  root_cause: "Guard de paso retorna 400 (BadRequest) en lugar de 403 (Forbidden). Semántica HTTP incorrecta — la acción está prohibida, no malformada."
  missing:
    - "Cambiar HttpException status de 400 a 403 en guard de paso (apps/api — paso controller/service)"

- truth: "Técnico solo ve tickets de su área/asignados, no tickets de otros técnicos"
  status: backlog
  reason: "User reported: siente que técnico puede llegar a ver ticket de otro técnico"
  severity: major
  missing:
    - "Filtrar GET /api/tickets para TECNICO: solo tickets donde tecnicoId = req.user.id O pasos asignados al técnico"
    - "ADMIN y MESA_AYUDA mantienen visibilidad completa"
    - "Frontend: técnico no ve lista global, solo 'mis tickets'"

- truth: "Rutas de tickets usan ID opaco (no secuencial) para evitar enumeración"
  status: backlog
  reason: "User requested: número de ticket (#9, etc.) no debe ser público en ningún lugar — rutas, UI, notificaciones WhatsApp — reemplazar con folio opaco"
  severity: major
  missing:
    - "Agregar campo folio (cuid2/nanoid) a tabla Ticket — mantener autoincrement solo para FK internas"
    - "Actualizar todas las rutas /api/tickets/:id a /api/tickets/:folio"
    - "Frontend: mostrar folio en lugar de #N en toda la UI (detalle, listas, notificaciones)"
    - "WhatsApp/notificaciones: reemplazar 'Ticket #9' con 'Folio: TKT-XXXX' usando folio opaco"
    - "Definir nomenclatura de folio: ej. STF-YYYYMM-XXXXX"
    - "Migración: generar folios para tickets existentes"

- truth: "Solo asignador del ticket (MESA_AYUDA/ADMIN) puede cerrarlo como RESUELTO"
  status: backlog
  reason: "User corrected design: técnico completa su paso, pero no puede cerrar el ticket — solo quien lo asignó"
  severity: major
  missing:
    - "Remover auto-resolución de ticket al completar último paso"
    - "Guard en cambiarEstado → RESUELTO: solo asignadorId == req.user.id puede hacerlo"
    - "Frontend: ocultar botón 'Resolver' para técnicos, solo visible para asignador"

- truth: "Encuesta de calidad al cerrar ticket — métricas de satisfacción empleado y técnico"
  status: backlog
  reason: "User requested: al cerrar ticket, lanzar encuesta al empleado (satisfacción con solución) y al técnico (calidad del proceso)"
  severity: major
  missing:
    - "Modelo: EncuestaCalidad con campos ticketId, respondidoPor (EMPLEADO/TECNICO), puntuacion (1-5), comentario, fechaRespuesta"
    - "Trigger: al cambiar estado → RESUELTO, crear registros EncuestaCalidad pendientes para empleado y técnico"
    - "Endpoint: POST /api/encuestas/:ticketFolio/responder"
    - "Frontend empleado: modal/página de encuesta al abrir ticket resuelto por primera vez"
    - "Frontend técnico: notificación de encuesta pendiente en su panel"
    - "Dashboard admin: métricas de satisfacción promedio por técnico, área, subcategoría"

- truth: "Dashboard métricas muestra sección de procesos SIRH/SIAST con nombres desde DB"
  status: failed
  reason: "Solo aparece sección 'Tecnologías' — SIRH/SIAST no se desglosa. Métricas poco legibles."
  severity: major
  test: 9
  root_cause: "MetricasAdmin/MetricasMesaAyuda no tiene sección de procesos. ProcesoDefinicion no se consulta. Sin gráfica de índice resolución/cancelación."
  missing:
    - "Sección 'Métricas por Proceso' en dashboard ADMIN/MESA_AYUDA — query ProcesoDefinicion desde DB"
    - "Desglose por proceso: tickets activos, resueltos, cancelados por SIRH/SIAST"
    - "Gráfica de índice de resolución vs cancelación (donut o bar chart con Recharts/nivo)"
    - "Etiquetas claras: valor absoluto + porcentaje + color semafórico (verde ≥80% resolución)"
    - "Progress bars actuales: agregar valor absoluto y tendencia (↑↓) junto al porcentaje"

- truth: "Técnicos organizados por área — jefe de área asigna/mueve tickets dentro de su área"
  status: backlog
  reason: "User requested: área como unidad organizativa — técnico responsable de área puede reasignar tickets a otros técnicos dentro de su área pero no del sistema completo"
  severity: major
  missing:
    - "Modelo: entidad Area con campos nombre, descripción. Relación Area → Tecnico (muchos a uno)"
    - "Rol nuevo: JEFE_AREA (puede asignar/mover tickets solo de su área)"
    - "ADMIN del sistema mantiene visibilidad y control global"
    - "Endpoint: PUT /api/tickets/:folio/asignar-tecnico — validar que técnico destino pertenece a misma área"
    - "Frontend: panel de área para JEFE_AREA — ver tickets del área, mover entre técnicos"

- truth: "UX del flujo de pasos (asignar/completar/estado) clara y sin ambigüedad"
  status: backlog
  reason: "User reported: interfaz de completar paso, asignar técnico y transiciones de estado es confusa/ambigua"
  severity: major
  missing:
    - "Revisar flujo completo: paso PENDIENTE → asignar técnico → EN_PROGRESO → completar → RESUELTO"
    - "Ocultar/deshabilitar acciones de estado que no aplican según estado actual del paso"
    - "Indicador visual claro del paso activo y qué acción sigue"
    - "Separar visualmente sección de pasos vs acciones del ticket"
