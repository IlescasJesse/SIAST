---
phase: 04-metricas-operacionales
plan: "02"
subsystem: api
tags: [express, prisma, typescript, metricas, zod, aggregation, sla, jwt]

# Dependency graph
requires:
  - phase: 04-metricas-operacionales
    plan: "01"
    provides: Tipos MetricasGlobalResponse, MetricasPorAreaResponse, MetricasPorTecnicoResponse en @stf/shared — consumidos por el servicio
  - phase: 03-roles-y-areas-de-soporte
    provides: Modelo AreaSoporte con areaSoporteId en Usuario, ROLES_RESPONSABLE, requireRol middleware

provides:
  - Servicio metricas.service.ts con aggregation real vía Prisma (SLA, tiempos, tendencia diaria, carga técnicos, primera respuesta)
  - Endpoint único GET /api/metricas?tipo=area|tecnico|proceso con Zod validation y role scoping
  - JwtPayload.areaSoporteId en token de staff para scoping seguro de RESPONSABLE_* sin DB lookup
  - Ruta única con 11 roles Phase 3+ incluidos

affects:
  - 04-03 (frontend metricas consume GET /api/metricas?tipo=area|tecnico|proceso)
  - 04-04 (daily snapshot job lee mismos datos calculados por el servicio)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Endpoint único paramétrico con Zod QuerySchema para validar tipo + fechas antes de llegar a Prisma"
    - "Role scoping de RESPONSABLE_* desde JWT (areaSoporteId en token) — sin DB lookup en el controlador"
    - "bigint → Number conversión obligatoria en todos los queryRaw antes de retornar al controlador"
    - "Prisma.sql tagged templates para parámetros dinámicos en raw SQL (no concatenación de strings)"
    - "SLA hardcodeado por categoría: TECNOLOGIAS=24h, SERVICIOS=48h, RECURSOS_MATERIALES=72h"

key-files:
  created:
    - apps/api/src/services/metricas.service.ts
  modified:
    - apps/api/src/controllers/metricas.controller.ts
    - apps/api/src/routes/metricas.routes.ts
    - apps/api/src/types/index.ts
    - apps/api/src/services/auth.service.ts

key-decisions:
  - "JWT de staff incluye areaSoporteId para RESPONSABLE_* — scoping seguro sin DB lookup en el controlador de métricas"
  - "TECNICO_SERVICIOS excluido de roles en rutas y controlador (no existe en enum Rol de @stf/shared — deprecated Phase 3)"
  - "RESPONSABLE_*: areaId siempre del JWT (user.areaSoporteId), no del query param — el query param es ignorado (T-04-02-01)"
  - "TECNICO_*: tecnicoId forzado a user.id para tipo=proceso, ignora query param tecnicoId (T-04-02-04)"

patterns-established:
  - "metricas.service.ts: helpers privados (calcularSLA, calcularTiempoPromedio, calcularTendencia, calcularTiemprimeraRespuesta) + 3 funciones públicas exportadas"
  - "Zod QuerySchema con .transform() — valida y convierte strings a Date/number antes de llegar al servicio"

requirements-completed: [MET-01, MET-02, MET-03, MET-04]

# Metrics
duration: 25min
completed: 2026-05-26
---

# Phase 4 Plan 02: Backend Metricas Endpoint Único Summary

**metricas.service.ts con aggregation real Prisma (SLA por categoría, carga técnicos, tendencia diaria) + endpoint único GET /api/metricas con Zod validation, scoping por JWT y 11 roles Phase 3+**

## Performance

- **Duration:** 25 min
- **Started:** 2026-05-26T17:10:00Z
- **Completed:** 2026-05-26T17:35:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- `metricas.service.ts` con 3 funciones exportadas y 4 helpers privados: SLA calculado por categoría con metas fijas (D-02), tendencia diaria via $queryRaw con bigint→Number, tiempo primera respuesta del técnico (D-04), carga y rendimiento por técnico
- Controlador unificado con un único export `obtener` — reemplaza 3 funciones legacy (metricasSolicitudes, metricasTecnicos, metricasProcesos) — Zod valida tipo + fechas con isNaN() → 400 antes de Prisma
- Role scoping crítico: RESPONSABLE_* recibe areaId del JWT (no del query param), TECNICO_* recibe tecnicoId forzado a user.id
- `areaSoporteId` agregado al JwtPayload y al signToken de loginStaff para habilitar el scoping sin DB lookup

## Task Commits

Cada tarea fue commiteada atómicamente:

1. **Tarea 1: Crear metricas.service.ts con aggregation real vía Prisma** - `5e91c05` (feat)
2. **Tarea 2: Refactorizar controlador y rutas para endpoint único con Zod** - `934d5b4` (feat)

**Plan metadata:** pendiente (docs commit)

## Files Created/Modified
- `apps/api/src/services/metricas.service.ts` — Servicio nuevo con obtenerMetricasGlobal, obtenerMetricasPorArea, obtenerMetricasPorTecnico + 4 helpers privados
- `apps/api/src/controllers/metricas.controller.ts` — Reemplazado: 1 export `obtener` con QuerySchema Zod + role scoping
- `apps/api/src/routes/metricas.routes.ts` — Reemplazado: ruta única `GET /` con 11 roles Phase 3+
- `apps/api/src/types/index.ts` — JwtPayload extendido con `areaSoporteId?: number`
- `apps/api/src/services/auth.service.ts` — loginStaff incluye areaSoporteId en payload del JWT si está disponible

## Decisions Made
- `areaSoporteId` incluido en el JWT de staff: permite al controlador de métricas hacer scoping por JWT sin un DB lookup adicional — consistente con el patrón de `requireResponsableDeArea` que sí hace DB lookup, pero aquí el volumen y frecuencia del endpoint justifica evitarlo
- `TECNICO_SERVICIOS` removido de roles en rutas y en el array ROLES_TECNICO del controlador: este rol está deprecated desde Phase 3 y no existe en el enum `Rol` de `@stf/shared` — intentar incluirlo causaba error de compilación TypeScript (TS2345)
- Funciones legacy `metricasSolicitudes`, `metricasTecnicos`, `metricasProcesos` eliminadas completamente del controlador: el plan especificaba esto como intencional — el frontend (Plan 03/04) usará el nuevo endpoint

## Deviations from Plan

### Auto-fixed Issues

**1. [Regla 2 - Funcionalidad Crítica Faltante] areaSoporteId incluido en JWT de staff**
- **Found during:** Tarea 2 (rol scoping en controlador)
- **Issue:** El plan especifica `user.areaSoporteId` del JWT para scoping de RESPONSABLE_*, pero `loginStaff` no incluía `areaSoporteId` en el payload — `user.areaSoporteId` siempre sería `undefined` → el controlador respondería 403 a todos los RESPONSABLE_*
- **Fix:** `JwtPayload.areaSoporteId?: number` agregado a `types/index.ts`; `loginStaff` en `auth.service.ts` incluye `areaSoporteId` en el payload si `user.areaSoporteId != null`
- **Files modified:** `apps/api/src/types/index.ts`, `apps/api/src/services/auth.service.ts`
- **Verification:** TypeScript build sin errores, campo tipado correctamente
- **Committed in:** `934d5b4` (Task 2 commit)

**2. [Regla 1 - Bug] TECNICO_SERVICIOS removido de roles**
- **Found during:** Tarea 2 (compilación TypeScript de metricas.routes.ts)
- **Issue:** `TECNICO_SERVICIOS` no existe en el enum `Rol` de `@stf/shared` (deprecated en Phase 3). Incluirlo en `requireRol(...)` causaba error TS2345
- **Fix:** Removido de la lista de roles en `metricas.routes.ts` y del array `ROLES_TECNICO` en `metricas.controller.ts`
- **Files modified:** `apps/api/src/routes/metricas.routes.ts`, `apps/api/src/controllers/metricas.controller.ts`
- **Verification:** `npx tsc --noEmit` sin errores
- **Committed in:** `934d5b4` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 funcionalidad crítica faltante, 1 bug)
**Impact on plan:** Ambas correcciones necesarias para que el scoping de seguridad funcione correctamente. Sin scope creep.

## Issues Encountered
- El enum `Rol` en `@stf/shared` no incluye `TECNICO_SERVICIOS` (deprecated en Phase 3). El plan lo listaba en el array de roles del controlador. La corrección fue inmediata — TypeScript detectó el error en compilación.

## Known Stubs
Ninguno — todas las funciones retornan datos reales de DB Prisma.

## Threat Flags
Ninguno — las superficies de seguridad del endpoint ya estaban en el threat model del plan (T-04-02-01 a T-04-02-05) y fueron implementadas.

## User Setup Required
Ninguno. Los tokens existentes de RESPONSABLE_* no incluyen `areaSoporteId` — deberán re-autenticarse (nuevo login) para obtener el campo en el JWT. No requiere configuración externa.

## Next Phase Readiness
- `GET /api/metricas?tipo=area|tecnico|proceso` disponible y funcional con datos reales de DB
- Scoping de seguridad operativo (RESPONSABLE_* y TECNICO_* protegidos)
- Plan 03 (frontend) puede consumir el endpoint directamente con los tipos de `@stf/shared`
- Plan 04 (daily snapshot job) puede usar las mismas funciones del servicio o hacer sus propias queries a `prisma.metricasHistorial`

---
*Phase: 04-metricas-operacionales*
*Completed: 2026-05-26*
