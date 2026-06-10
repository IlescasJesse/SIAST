---
phase: 03-roles-y-areas-de-soporte
plan: "05"
subsystem: usuarios
tags: [gap-closure, validation, frontend, backend, fieldErrors]
dependency_graph:
  requires: []
  provides: [validacion-backend-usuarios, fieldErrors-AdminUsuariosPage, fieldErrors-UsuariosPage]
  affects: [apps/api/src/controllers/usuarios.controller.ts, apps/web/src/pages/AdminUsuariosPage.jsx, apps/web/src/pages/UsuariosPage.jsx]
tech_stack:
  added: []
  patterns: [fieldErrors-por-campo, validacion-antes-de-prisma, 400-con-campos-array]
key_files:
  created: []
  modified:
    - apps/api/src/controllers/usuarios.controller.ts
    - apps/web/src/pages/AdminUsuariosPage.jsx
    - apps/web/src/pages/UsuariosPage.jsx
decisions:
  - "usuario desestructurado explícitamente en crear() para evitar que quede en ...rest y se duplique"
  - "actualizar() usa usuarioActualizado como nombre de variable para evitar conflicto con usuario del body"
  - "fieldErrors se limpia campo por campo en onChange para UX inmediata"
metrics:
  duration: "20m"
  completed: "2026-05-25"
  tasks_completed: 3
  tasks_total: 3
---

# Phase 03 Plan 05: Gap Closure — Validación de campos requeridos en usuarios Summary

Gap closure que corrige dos defectos detectados en UAT: (1) PATCH con usuario vacío lanzaba UniqueConstraint de Prisma en lugar de 400 útil, y (2) los formularios de usuario mostraban un Alert genérico en lugar de errores por campo con helperText.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Validación backend usuarios.controller.ts | ec84ec5 | apps/api/src/controllers/usuarios.controller.ts |
| 2 | fieldErrors en AdminUsuariosPage.jsx | 54c6fe5 | apps/web/src/pages/AdminUsuariosPage.jsx |
| 3 | fieldErrors y limpieza de form en UsuariosPage.jsx | 7d84cae | apps/web/src/pages/UsuariosPage.jsx |

## Changes by File

### apps/api/src/controllers/usuarios.controller.ts

**crear():**
- Desestructura `usuario` explícitamente (antes quedaba en `...rest`, causando paso implícito a Prisma)
- Valida nombre, apellidos, usuario, rol y password antes de cualquier operación async
- Retorna HTTP 400 `{ error, campos: string[] }` si falta algún campo
- Pasa `usuario` explícitamente a `prisma.usuario.create()` en el objeto `data`
- Variable del resultado renombrada a `usuarioCreado` para evitar colisión de nombres

**actualizar():**
- Desestructura `usuario` explícitamente del body
- Valida que usuario/nombre/apellidos no sean cadenas vacías si vienen en el body
- Retorna HTTP 400 `{ error, campos: string[] }` antes de tocar Prisma
- Incluye `data.usuario = usuario.trim()` cuando viene en el body
- Variable del resultado renombrada a `usuarioActualizado` para evitar colisión
- ROL_AREA_MAP y resolveAreaId sin ningún cambio

### apps/web/src/pages/AdminUsuariosPage.jsx

- Agrega estado `fieldErrors` (objeto vacío por defecto)
- `abrirCrear` y `abrirEditar` limpian `fieldErrors` y `error` al abrir dialog
- `guardar()` valida nombre/apellidos/usuario/password (en crear) antes de llamar al backend
- Si hay errores frontend, setFieldErrors y return sin llamada HTTP
- TextField Nombre, Apellidos, Usuario, Contraseña con `error={Boolean(fieldErrors.X)}` y `helperText={fieldErrors.X}`
- `onChange` de cada campo limpia su propio `fieldErrors[campo]` para UX inmediata
- Errores de backend con `campos[]` se mapean a `fieldErrors` en lugar de Alert genérico
- `delete payload.areaSoporteId` — el backend lo deriva del rol
- Limpia form con `EMPTY_FORM` tras éxito (antes no limpiaba)

### apps/web/src/pages/UsuariosPage.jsx

- Agrega estado `fieldErrors` (objeto vacío por defecto)
- `openCrear` y `openEditar` limpian `fieldErrors` al abrir dialog
- `handleGuardar()` reemplaza los dos `setError(...)` de validación por `fieldErrors` por campo
- Valida nombre, apellidos, usuario, rol y password (en crear) antes de llamada HTTP
- TextField Nombre, Apellidos, Usuario (login), Contraseña con `error` y `helperText`
- `onChange` de cada campo limpia su propio `fieldErrors[campo]`
- Errores de backend con `campos[]` se mapean a `fieldErrors`
- Alert de `error` general se mantiene para errores sin campo específico (ej: "El usuario ya existe")
- `delete payload.areaSoporteId` — el backend lo deriva del rol
- Limpia form con `emptyForm` y `fieldErrors` tras éxito
- Funcionalidad SIRH (tarjeta sync, búsqueda RFC, handleSyncNow, loadSyncStatus) intacta

## Verification

```
# Build monorepo completo
npm run build

Resultados:
- apps/api: Build success (ESM + CJS) — sin errores TypeScript
- apps/web: Build success (Vite) — sin errores
- apps/modelado-3d: Build success
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Colisión de nombre de variable `usuario` en crear() y actualizar()**
- **Found during:** Task 1 — build falló con "The symbol 'usuario' has already been declared"
- **Issue:** Al desestructurar `usuario` del body, la variable local `const usuario = await prisma.usuario.create(...)` en crear() y `const usuario = await prisma.usuario.update(...)` en actualizar() colisionaban con la variable desestructurada
- **Fix:** Renombrar las variables de resultado a `usuarioCreado` y `usuarioActualizado` respectivamente
- **Files modified:** apps/api/src/controllers/usuarios.controller.ts
- **Commit:** ec84ec5 (incluido en mismo commit de Task 1)

## Known Stubs

None — todos los campos del formulario están conectados a estado real y APIs existentes.

## Self-Check: PASSED

- [x] apps/api/src/controllers/usuarios.controller.ts — modificado, commit ec84ec5 verificado
- [x] apps/web/src/pages/AdminUsuariosPage.jsx — modificado, commit 54c6fe5 verificado
- [x] apps/web/src/pages/UsuariosPage.jsx — modificado, commit 7d84cae verificado
- [x] Build monorepo completo pasa sin errores
- [x] No existe selector de areaSoporte en ninguno de los dos formularios
- [x] ROL_AREA_MAP y resolveAreaId intactos en controller
