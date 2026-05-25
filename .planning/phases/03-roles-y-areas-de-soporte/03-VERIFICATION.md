---
phase: 03-roles-y-areas-de-soporte
verified: 2026-05-25T22:00:00Z
status: gaps_found
score: 4/5 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Panel admin muestra selector de AreaSoporte al crear/editar usuario con rol RESPONSABLE_*"
    status: failed
    reason: "ROL-05 requiere un selector visual de AreaSoporte. Plan 05 (gap closure) eliminó el selector y cambió el diseño a derivación automática del areaSoporteId desde el rol en el backend (ROL_AREA_MAP). El formulario actual no muestra ningún selector de área. Esto es una desviación del texto literal del requisito."
    artifacts:
      - path: "apps/web/src/pages/UsuariosPage.jsx"
        issue: "No existe ningún FormControl/Select de areaSoporte. emptyForm no tiene areaSoporteId. El payload hace delete payload.areaSoporteId antes de enviar."
      - path: "apps/web/src/pages/AdminUsuariosPage.jsx"
        issue: "No existe ningún FormControl/Select de areaSoporte. El payload hace delete payload.areaSoporteId antes de enviar."
    missing:
      - "O bien: re-agregar el selector condicional de AreaSoporte para roles RESPONSABLE_* en ambas páginas (cumplir ROL-05 literalmente)"
      - "O bien: actualizar el texto de ROL-05 en REQUIREMENTS.md para reflejar el nuevo diseño de derivación automática y agregar un override en este archivo"
---

# Phase 03: Roles y Áreas de Soporte — Verification Report

**Phase Goal:** Reestructurar el sistema de roles para reflejar la organización real de soporte: 4 áreas (TI, REDES, MANTENIMIENTO, RECURSOS MATERIALES) con responsables y técnicos especializados.
**Verified:** 2026-05-25T22:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 7 nuevos roles en enum Rol de Prisma y en RolSchema Zod | VERIFIED | `schema.prisma` líneas 25-31: RESPONSABLE_TI, RESPONSABLE_REDES, RESPONSABLE_MANTENIMIENTO, RESPONSABLE_RECURSOS_MATERIALES, TECNICO_ELECTRICISTA, TECNICO_PLOMERO, TECNICO_MOVILIDAD. `shared/src/index.ts` líneas 12-21: mismos 7 roles en RolSchema. |
| 2 | Entidad AreaSoporte en DB con 4 áreas seed y areaSoporteId en Usuario | VERIFIED | `schema.prisma` líneas 152-162: modelo AreaSoporte completo. `Usuario` líneas 126-127: campo areaSoporteId + relación. `seed.ts` líneas 269-299: 4 áreas upsertadas (TI, REDES, MANTENIMIENTO, RECURSOS_MATERIALES). Migración `20260513183619_roles_y_areas_soporte` aplicada. |
| 3 | Backend: requireResponsableDeArea(), guards asignarTicket + cambiarEstado, endpoint GET /areas-soporte | VERIFIED | `roles.middleware.ts`: ROLES_RESPONSABLE y requireResponsableDeArea() exportadas con DB read (líneas 6-74). `tickets.service.ts`: guard ROLES_RESPONSABLE en asignarTicket (línea 383) y cambiarEstado (línea 458). `admin.routes.ts`: GET /areas-soporte con handler inline (línea 47). |
| 4 | RESPONSABLE_* puede reasignar y cerrar/cancelar solicitudes de su área solamente | VERIFIED | `tickets.service.ts` asignarTicket: verifica rolesArea.includes(tecnico.rol) (líneas 383-401). cambiarEstado: verifica subcategorias.includes(ticket.subcategoria) (líneas 458-470). listarTickets: branch RESPONSABLE_* filtra por subcategorías del área (líneas 90-103). Backend valida campos requeridos con HTTP 400 antes de Prisma (usuarios.controller.ts líneas 67-74). |
| 5 | Panel admin muestra selector de AreaSoporte al crear/editar usuario con rol RESPONSABLE_* | FAILED | ROL-05 requiere un selector visual. La implementación actual elimina el selector — Plan 05 cambió el diseño a derivación automática (ROL_AREA_MAP en backend). Ninguna de las dos páginas muestra selector de área. |

**Score:** 4/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/database/prisma/schema.prisma` | Enum Rol extendido (14 valores) + modelo AreaSoporte + FK en Usuario | VERIFIED (con nota) | Enum tiene 17 valores (14 previstos + 3 roles GESTOR adicionales de migración posterior `20260525175530_gestor_roles`). AreaSoporte model presente. areaSoporteId en Usuario presente. TECNICO_SERVICIOS preservado en schema para compat DB. |
| `packages/shared/src/index.ts` | RolSchema + PERMISOS_DEFAULT + LABEL_ROL actualizados | VERIFIED (con nota) | RolSchema tiene los 7 nuevos roles (más GESTOR_SALAS_JUNTA, GESTOR_RECURSOS, GESTOR_INVENTARIO de fase posterior). TECNICO_SERVICIOS ausente del RolSchema — eliminado intencionalmente (ROADMAP: "reemplaza TECNICO_SERVICIOS"). PERMISOS_DEFAULT cubre todos los roles activos. LABEL_ROL actualizado. |
| `packages/database/prisma/migrations/` | Migración con ALTER TABLE roles y CREATE TABLE areas_soporte | VERIFIED | `20260513183619_roles_y_areas_soporte/migration.sql` contiene MODIFY rol ENUM con 14 valores + TECNICO_SERVICIOS + CREATE TABLE areas_soporte + ADD COLUMN area_soporte_id. |
| `packages/database/prisma/seed.ts` | 4 AreaSoporte upsertadas | VERIFIED | Líneas 269-299: upsert de TI, REDES, MANTENIMIENTO, RECURSOS_MATERIALES por nombre (unique key). |
| `packages/database/prisma/seed_procesos.ts` | SANITARIOS, ILUMINACION, MOVILIDAD con sus roles respectivos | VERIFIED | Líneas 182-201: SANITARIOS → TECNICO_PLOMERO, ILUMINACION → TECNICO_ELECTRICISTA, MOVILIDAD → TECNICO_MOVILIDAD. tipoFlujo DIRECTO. |
| `apps/api/src/middleware/roles.middleware.ts` | requireResponsableDeArea() con DB read | VERIFIED | Función exportada (líneas 23-74), ROLES_RESPONSABLE exportado (líneas 6-11), import prisma (línea 4). |
| `apps/api/src/services/tickets.service.ts` | Guards de área, bug fix crearTicket, branch RESPONSABLE_* listarTickets, CATEGORIA_ROL_MAP actualizado | VERIFIED | CATEGORIA_ROL_MAP.SERVICIOS (línea 343): TECNICO_ELECTRICISTA, TECNICO_PLOMERO, TECNICO_MOVILIDAD (TECNICO_SERVICIOS ausente — eliminado por diseño). crearTicket: `["TECNOLOGIAS", "SERVICIOS"].includes(categoriaVal)` (línea 265). listarTickets branch RESPONSABLE_* (líneas 90-103). Guards asignarTicket y cambiarEstado presentes. |
| `apps/api/src/controllers/usuarios.controller.ts` | areaSoporteId en userSelect, validación RESPONSABLE_*, derivación automática ROL_AREA_MAP | VERIFIED | userSelect línea 45: areaSoporteId. ROL_AREA_MAP líneas 5-19 mapea roles a nombres de área. resolveAreaId() líneas 21-26. Validación campos requeridos líneas 67-74. |
| `apps/api/src/routes/admin.routes.ts` | GET /areas-soporte endpoint | VERIFIED | Handler inline listarAreasSoporte (líneas 15-25), ruta GET /areas-soporte (línea 47), protegida por requireRol("ADMIN") a nivel de router (línea 13). |
| `apps/api/src/routes/tickets.routes.ts` | requireRol extendido con RESPONSABLE_* y nuevos TECNICO_* | VERIFIED | /asignar (líneas 23-30): RESPONSABLE_*. /estado (líneas 31-42): todos TECNICO_* + RESPONSABLE_*. /comentarios (líneas 43-53): extendido. /pasos/completar (líneas 54-61): nuevos TECNICO_*. /pasos/asignar (líneas 62-69): RESPONSABLE_*. |
| `apps/web/src/api/catalogos.js` | getAreasSoporte() | VERIFIED | Línea 31: función exportada, llama /api/admin/areas-soporte, retorna r.data.data. |
| `apps/web/src/api/admin.js` | getAreasSoporte() | VERIFIED | Línea 23: función exportada. |
| `apps/web/src/pages/UsuariosPage.jsx` | ROLES_STAFF extendido + fieldErrors + no selector areaSoporte | VERIFIED (parcial) | ROL_GRUPOS (líneas 27-33) cubre todos los roles nuevos. fieldErrors state (línea 55) y helperText en campos (líneas 522-562). Sin selector de areaSoporte — diseño cambiado en Plan 05. |
| `apps/web/src/pages/AdminUsuariosPage.jsx` | ROLES extendido + fieldErrors + no selector areaSoporte | VERIFIED (parcial) | ROL_GRUPOS (líneas 18-22) con todos los roles nuevos. fieldErrors state (línea 38). Sin selector de areaSoporte — diseño cambiado en Plan 05. |
| `apps/web/src/store/notificaciones.js` | join:admin emitido para RESPONSABLE_* | VERIFIED | Líneas 65-69: RESPONSABLE_TI y RESPONSABLE_REDES incluidos en condición join:admin. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `schema.prisma` | `shared/src/index.ts` | Enum Rol — ambos deben tener los 14 valores activos | VERIFIED | Ambos tienen los mismos 7 roles nuevos + roles base. TECNICO_SERVICIOS ausente de shared intencionalmente (deprecated). |
| `schema.prisma` | modelo AreaSoporte | Usuario.areaSoporteId → @relation AreaSoporte | VERIFIED | Relación bidireccional presente: areaSoporteId en Usuario + usuarios[] en AreaSoporte. |
| `tickets.routes.ts` | `roles.middleware.ts` | requireRol() en cadena con nuevos roles | VERIFIED | requireRol() con todos los RESPONSABLE_* y TECNICO_* nuevos en cada ruta relevante. |
| `tickets.service.ts` | `areaSoporte DB table` | prisma.areaSoporte.findUnique() para scope check | VERIFIED | Líneas 388-390 (asignarTicket) y 463-465 (cambiarEstado): findUnique sobre areaSoporte. |
| `admin.routes.ts` | GET /api/admin/areas-soporte | handler inline prisma.areaSoporte.findMany() | VERIFIED | Handler en líneas 15-25, ruta registrada línea 47, datos reales de DB. |
| `UsuariosPage.jsx` | `api/catalogos.js` | getAreasSoporte() en useEffect | NOT_WIRED | UsuariosPage ya NO llama getAreasSoporte() — Plan 05 eliminó el selector y el useEffect asociado. La función existe en catalogos.js pero no se usa en esta página. |
| `AdminUsuariosPage.jsx` | `api/admin.js` | getAreasSoporte() en useEffect | NOT_WIRED | AdminUsuariosPage ya NO llama getAreasSoporte() — Plan 05 eliminó el selector. La función existe en admin.js pero no se usa en esta página. |

**Nota sobre key links NOT_WIRED:** Las funciones getAreasSoporte() existen pero están desconectadas porque Plan 05 eliminó el selector. Esto es consistente con el nuevo diseño, pero confirma el gap en ROL-05.

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `admin.routes.ts` listarAreasSoporte | `data` (AreaSoporte[]) | `prisma.areaSoporte.findMany({ where: { activo: true } })` | Yes — DB query real | FLOWING |
| `tickets.service.ts` listarTickets (RESPONSABLE_*) | `where.subcategoria` | `prisma.areaSoporte.findUnique` → subcategorias JSON field | Yes — DB query real | FLOWING |
| `tickets.service.ts` asignarTicket guard | `rolesArea` (string[]) | `prisma.areaSoporte.findUnique` → rolesIncluidos JSON field | Yes — DB query real | FLOWING |
| `usuarios.controller.ts` resolveAreaId | `areaSoporteId` (number) | `prisma.areaSoporte.findUnique({ where: { nombre: areaNombre } })` | Yes — DB query real | FLOWING |

### Behavioral Spot-Checks

| Behavior | Evidence | Status |
|----------|----------|--------|
| requireResponsableDeArea() hace DB read, no usa JWT | `prisma.usuario.findUnique({ where: { id: req.user.id }, select: { areaSoporteId: true } })` en roles.middleware.ts línea 42-45 | PASS |
| crearTicket genera pasos para SERVICIOS (bug fix) | `if (["TECNOLOGIAS", "SERVICIOS"].includes(categoriaVal))` línea 265 tickets.service.ts | PASS |
| RESPONSABLE_* ve solo tickets de su área | `where.subcategoria = { in: areaSoporte.subcategorias as string[] }` línea 100 tickets.service.ts | PASS |
| GET /areas-soporte protegida por ADMIN | `router.use(authMiddleware, requireRol("ADMIN"))` línea 13 admin.routes.ts, ruta hereda la protección | PASS |
| Backend valida campos vacíos antes de Prisma | `camposFaltantes` validación en usuarios.controller.ts líneas 67-75, retorna HTTP 400 con `campos` array | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| ROL-01 | 03-01 | 7 nuevos valores en enum Rol en Prisma y RolSchema Zod | SATISFIED | schema.prisma enum + shared/index.ts RolSchema contienen los 7 nuevos roles |
| ROL-02 | 03-01, 03-02 | AreaSoporte en DB con 4 áreas seed y areaSoporteId en Usuario | SATISFIED | modelo AreaSoporte, migración aplicada, seed.ts con 4 áreas, FK en Usuario |
| ROL-03 | 03-03 | Backend guards requireResponsableDeArea(), extensión asignarTicket + cambiarEstado, endpoint GET /areas-soporte | SATISFIED | Todos los componentes implementados y verificados |
| ROL-04 | 03-03, 03-05 | RESPONSABLE_* puede reasignar y cerrar/cancelar solicitudes de su área | SATISFIED | Guards de scope en asignarTicket y cambiarEstado, validación backend con 400 |
| ROL-05 | 03-04, 03-05 | Panel admin muestra selector de AreaSoporte al crear/editar usuario con rol RESPONSABLE_* | BLOCKED | Plan 05 eliminó el selector — el área se deriva automáticamente del rol. El requisito literal no está cumplido. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web/src/api/catalogos.js` | 31 | `getAreasSoporte()` exportada pero no usada por ninguna página | Info | Código muerto — no bloquea funcionalidad pero puede confundir |
| `apps/web/src/api/admin.js` | 23 | `getAreasSoporte()` exportada pero no usada por ninguna página | Info | Código muerto — no bloquea funcionalidad |
| `packages/database/prisma/schema.prisma` | 20 | TECNICO_SERVICIOS en enum pero ausente de RolSchema en shared | Warning | Desincronización entre schema.prisma y RolSchema Zod — Prisma permite el valor en DB pero el sistema de tipos TypeScript no lo reconoce. Usuarios con ese rol podrían causar errores en servicios que usan `Rol` type de @stf/shared. |

### Human Verification Required

None — todas las verificaciones son programáticas para este reporte.

### Gaps Summary

**Gap 1 — ROL-05 FAILED: Selector de AreaSoporte eliminado (Plan 05 cambió el diseño)**

El Plan 04 implementó un selector condicional de AreaSoporte en UsuariosPage y AdminUsuariosPage. El Plan 05 (gap closure UAT) revirtió este diseño: eliminó el selector y movió la responsabilidad al backend — `ROL_AREA_MAP` en `usuarios.controller.ts` deriva automáticamente el `areaSoporteId` desde el nombre del rol. El payload hace `delete payload.areaSoporteId` antes de enviar.

El requisito ROL-05 dice: "Panel admin muestra selector de AreaSoporte al crear/editar usuario con rol RESPONSABLE_*". La implementación actual no lo hace.

**Opciones para resolver:**
1. Re-agregar el selector condicional (implementar ROL-05 literalmente)
2. Actualizar ROL-05 en REQUIREMENTS.md para reflejar el nuevo diseño y agregar un override en este archivo VERIFICATION.md

**Nota sobre TECNICO_SERVICIOS:**
- `schema.prisma`: TECNICO_SERVICIOS presente (para compatibilidad con filas existentes en DB)
- `shared/src/index.ts` RolSchema: TECNICO_SERVICIOS ausente (reemplazado por 3 nuevos roles)
- Esta desincronización es intencion del ROADMAP ("reemplaza TECNICO_SERVICIOS") pero crea un riesgo: usuarios con ese rol en DB podrían causar errores en código que use el tipo `Rol` de @stf/shared
- `CATEGORIA_ROL_MAP.SERVICIOS` en tickets.service.ts tampoco incluye TECNICO_SERVICIOS — tickets de categoria SERVICIOS no se rutearan a usuarios con ese rol deprecated
- Clasificado como WARNING (no BLOCKER) porque es decisión arquitectónica documentada

---

_Verified: 2026-05-25T22:00:00Z_
_Verifier: Claude (gsd-verifier)_
