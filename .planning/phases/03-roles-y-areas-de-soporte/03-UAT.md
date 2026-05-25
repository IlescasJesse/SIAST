---
status: resolved
phase: 03-roles-y-areas-de-soporte
source:
  - 03-01-SUMMARY.md
  - 03-02-SUMMARY.md
  - 03-03-SUMMARY.md
  - 03-04-SUMMARY.md
  - 03-05-SUMMARY.md
started: 2026-05-25T00:00:00Z
updated: 2026-05-25T22:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: |
  Detener cualquier servidor corriendo. Iniciar la aplicación desde cero (npm run dev).
  La API debe arrancar sin errores. La DB debe tener 4 registros en areas_soporte (TI, REDES,
  MANTENIMIENTO, RECURSOS_MATERIALES) y 3 registros en proceso_definicion para SANITARIOS,
  ILUMINACION y MOVILIDAD. Una consulta básica (health check o carga del frontend) retorna
  datos reales sin errores.
result: pass
notes: DB verificada via Prisma client — 4 areas_soporte, 1 proc/SANITARIOS, 1/ILUMINACION, 1/MOVILIDAD. Build API+web limpio.

### 2. Nuevos roles en selector al crear usuario
expected: |
  Abrir el formulario de creación de usuario (UsuariosPage o AdminUsuariosPage).
  En el selector de Rol, deben aparecer los 14 roles incluyendo los nuevos:
  RESPONSABLE_TI, RESPONSABLE_REDES, RESPONSABLE_MANTENIMIENTO, RESPONSABLE_RECURSOS_MATERIALES,
  TECNICO_ELECTRICISTA, TECNICO_PLOMERO y TECNICO_MOVILIDAD.
result: pass

### 3. Selector Área de Soporte visible solo para RESPONSABLE_*
expected: |
  Al seleccionar un rol RESPONSABLE_* (ej. RESPONSABLE_TI) en el formulario de usuario,
  debe aparecer un selector de "Área de Soporte" con las 4 áreas (TI, REDES, MANTENIMIENTO,
  RECURSOS_MATERIALES). Al seleccionar cualquier otro rol (ej. TECNICO_ELECTRICISTA o EMPLEADO),
  el selector no debe aparecer.
result: pass
notes: Visual correcto — selector aparece/desaparece según rol. Incoherencia de diseño detectada: RESPONSABLE_TI implica área TI por nombre de rol; selector debería auto-asignar área en lugar de requerir selección manual. Pendiente de rediseño.

### 4. Selector Área de Soporte se limpia al cambiar rol
expected: |
  En el formulario de usuario, seleccionar RESPONSABLE_TI y asignar un Área de Soporte.
  Luego cambiar el rol a cualquier rol no-RESPONSABLE_*. El selector de Área de Soporte
  debe desaparecer y el valor debe quedar en null (no persiste el área anterior).
result: issue
reported: "El selector existe pero el área debe ser IMPLÍCITA según el nombre del rol. RESPONSABLE_TI → área TI automática. areaSoporteId explícito es diseño incorrecto — el área se debe derivar del rol en backend, no asignar manualmente."
severity: major

### 5. Editar usuario con RESPONSABLE_* muestra su área asignada
expected: |
  Abrir el formulario de edición de un usuario que ya tenga rol RESPONSABLE_* y un área asignada.
  El selector de Área de Soporte debe aparecer con el área correcta preseleccionada.
result: skipped
reason: Bloqueado por gap de diseño (Test 4) — área explícita será eliminada y reemplazada por derivación implícita desde nombre de rol. Retestear tras fix.

### 6. RESPONSABLE_* recibe notificaciones de tickets nuevos
expected: |
  Con un usuario RESPONSABLE_* activo (sesión iniciada), crear un ticket nuevo desde
  otro usuario. El RESPONSABLE_* debe recibir la notificación de ticket:nuevo en tiempo real
  (misma sala que admin), sin necesidad de recargar la página.
result: skipped
reason: Requiere rediseño de roles completado primero para que el usuario de prueba tenga área inferida correctamente.

### 7. RESPONSABLE_* ve solo tickets de su área
expected: |
  Iniciar sesión como un usuario RESPONSABLE_* (ej. RESPONSABLE_TI asignado al área TI).
  En el listado de tickets, solo deben aparecer tickets cuyas subcategorías pertenezcan al área TI.
  Tickets de otras áreas (REDES, MANTENIMIENTO) no deben ser visibles.
result: skipped
reason: Bloqueado por gap de diseño (Test 4) — filtrado de tickets depende de área inferida desde rol, no de areaSoporteId explícito.

### 8. RESPONSABLE_* puede asignar ticket a técnico de su área
expected: |
  Como RESPONSABLE_TI, intentar asignar un ticket del área TI a un técnico que pertenezca
  al área TI. La asignación debe completarse con éxito (HTTP 200, ticket actualizado).
result: skipped
reason: Bloqueado por gap de diseño (Test 4) — lógica de asignación depende de área inferida.

### 9. Crear ticket en subcategoría SANITARIOS/ILUMINACION/MOVILIDAD genera pasos
expected: |
  Crear un ticket con categoría SERVICIOS y subcategoría SANITARIOS (o ILUMINACION o MOVILIDAD).
  El ticket debe crearse con pasos generados automáticamente (proceso_definicion type DIRECTO con 1 paso).
  Antes del fix, tickets SERVICIOS no generaban pasos — ahora deben generarse.
result: skipped
reason: Pendiente retestear tras rediseño de roles.

### 10. Nuevos TECNICO_* pueden completar pasos de ticket
expected: |
  Iniciar sesión como TECNICO_ELECTRICISTA (o TECNICO_PLOMERO o TECNICO_MOVILIDAD).
  Navegar a un ticket asignado. El botón/acción de "completar paso" debe estar disponible
  y ejecutarse correctamente (HTTP 200).
result: skipped
reason: Pendiente retestear tras rediseño de roles.

## Summary

total: 10
passed: 3
issues: 1
skipped: 6
pending: 0

## Gaps

- truth: "El área de soporte debe derivarse implícitamente del nombre del rol, no asignarse manualmente"
  status: failed
  reason: "User reported: areaSoporteId explícito es diseño incorrecto. RESPONSABLE_TI → área TI automática, RESPONSABLE_REDES → REDES, etc. TECNICO_ELECTRICISTA → MANTENIMIENTO implícito."
  severity: major
  test: 4
  artifacts:
    - apps/api/src/controllers/usuarios.controller.ts
    - packages/database/prisma/schema.prisma (campo areaSoporteId en Usuario)
    - apps/web (formulario usuario — selector areaSoporte)
  missing:
    - Función helper: getRoleArea(rol: Rol): AreaSoporte | null
    - Lógica en backend para derivar área del nombre de rol al crear/editar usuario
    - Eliminar selector areaSoporte del frontend
    - Eliminar areaSoporteId del body en endpoints POST/PUT /usuarios
    - Mapa de roles a áreas: RESPONSABLE_TI→TI, RESPONSABLE_REDES→REDES, RESPONSABLE_MANTENIMIENTO→MANTENIMIENTO, RESPONSABLE_RECURSOS_MATERIALES→RECURSOS_MATERIALES, TECNICO_ELECTRICISTA/PLOMERO/MOVILIDAD→MANTENIMIENTO

## Next-Phase Notes

- **Validación de formularios (para Fase 04 o fase dedicada):**
  - Formulario editar usuario permite guardar sin `usuario` (nombre de usuario vacío/null) →
    Prisma lanza `Unique constraint failed on usuarios_usuario_key`
  - Necesario: validación required en todos los campos obligatorios antes de submit
  - Limpiar inputs tras submit/error y mostrar errores específicos por campo (no toasts genéricos)
  - Eliminar comportamiento legado que omite validación en el controller
  - Error exacto: `prisma.usuario.update()` falla en `usuarios.controller.ts:102`
- **Auto-asignación de área por rol (rediseño):**
  - `RESPONSABLE_TI` → área TI implícita; `RESPONSABLE_REDES` → área REDES, etc.
  - El selector manual es redundante — al elegir rol RESPONSABLE_*, el área debe auto-asignarse
  - Eliminar selector manual y reemplazar con lógica automática: `area = rol.split("RESPONSABLE_")[1]`
