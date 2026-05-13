---
status: testing
phase: 02-features-pendientes-procesos-y-flujos
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md, 02-04-SUMMARY.md]
started: 2026-05-12T00:00:00Z
updated: 2026-05-12T00:00:00Z
---

## Current Test

number: 7
name: Solo técnico asignado puede completar su paso
expected: |
  Asigna el paso de un ticket a un técnico específico. Intenta completarlo
  autenticado como técnico diferente (mismo rol). La API debe responder 403
  "Solo el técnico asignado puede completar este paso".
  Si el paso no tiene técnico asignado (tecnicoId null), cualquier técnico
  con rol correcto puede completarlo.
awaiting: user response

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
result: [pending]

### 8. Completar último paso resuelve ticket automáticamente
expected: Con un ticket SIRH de 1 paso, completa ese paso como el técnico asignado. El ticket debe cambiar automáticamente a estado RESUELTO. El historialTicket debe registrar el cambio con el estado anterior correcto (no hardcodeado "EN_PROGRESO" sino el estado real previo).
result: [pending]

### 9. Métricas de procesos muestran nombres desde DB
expected: Accede al dashboard de métricas (como ADMIN o MESA_AYUDA). En la sección de métricas por proceso, los procesos SIRH y SIAST deben aparecer con nombres "Soporte SIRH" y "Soporte SIAST" respectivamente — nombres que vienen de ProcesoDefinicion en DB, no de un mapa hardcodeado.
result: [pending]

### 10. Monorepo compila sin errores TypeScript
expected: Desde la raíz del proyecto, ejecuta `npx tsc --noEmit -p packages/shared/tsconfig.json`, luego `-p packages/database/tsconfig.json`, luego `-p apps/api/tsconfig.json`. Los tres deben completar sin errores (salida vacía = éxito). No debe existir ningún import de PROCESO_MAP, getProcesoKey ni getProcesoInfo en apps/.
result: [pending]

## Summary

total: 10
passed: 6
issues: 0
pending: 4
fixed_during_uat: 3
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

- truth: "UX del flujo de pasos (asignar/completar/estado) clara y sin ambigüedad"
  status: backlog
  reason: "User reported: interfaz de completar paso, asignar técnico y transiciones de estado es confusa/ambigua"
  severity: major
  missing:
    - "Revisar flujo completo: paso PENDIENTE → asignar técnico → EN_PROGRESO → completar → RESUELTO"
    - "Ocultar/deshabilitar acciones de estado que no aplican según estado actual del paso"
    - "Indicador visual claro del paso activo y qué acción sigue"
    - "Separar visualmente sección de pasos vs acciones del ticket"
