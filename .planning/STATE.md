# Project State

**Project:** SIAST — Sistema Integral de Atención y Soporte Técnico
**Initialized:** 2026-05-06
**Mode:** YOLO
**Current Milestone:** M1 — Sistema estable, seguro y con features completas

## Current Phase

**Phase 4: Métricas Operacionales** — Plan 02 complete, Plan 03 ready
- Status: In progress (Plan 02 executed 2026-05-26)
- Decisions: Recharts, SLA fijo, endpoint único, tabs en DashboardPage, ticketsVersion pattern
- Plan 01 decisions: areaSoporteId nullable sin @relation (integridad histórica), columnas tipadas sobre JSON monolítico, tipos legacy conservados para retrocompatibilidad
- Plan 02 decisions: JWT de staff incluye areaSoporteId para RESPONSABLE_* scoping; TECNICO_SERVICIOS excluido (no en enum Rol); RESPONSABLE_* areaId siempre del JWT; funciones legacy eliminadas del controlador
- Next: Plan 03 — Frontend atoms: recharts, SlaIndicator, 3 chart wrappers, DateRangeFilter, tablas

## Completed Phases

**Phase 3: Roles y Áreas de Soporte** — COMPLETE (incl. gap closure)
- Status: Complete (2026-05-25, gap closure 03-05 ejecutado)
- Plans: 5 (03-01 a 03-05) — schema, seed, backend, frontend + gap closure validaciones
- All 5 plans executed on main. API + Web build verified.
- Decisions: 14 roles, 4 AreaSoporte, areaSoporteId en Usuario, guards RESPONSABLE_*, fieldErrors por campo en formularios usuario, validación 400 antes de Prisma

**Phase 2: Features Pendientes — Procesos y Flujos** — COMPLETE
- Status: Complete (2026-05-13)
- Plans: 5 (02-01 a 02-05) — 4 base + 1 gap closure
- Verification: 14/14 must-haves passed
- Decisions: ProcesoDefinicion DB operativa, PROCESO_MAP eliminado, historialTicket audit trail completo

**Phase 1: Seguridad y Estabilidad** — COMPLETE
- Status: Complete
- Plans: 3 (01-01, 01-02, 01-03) in 2 waves
- Last Activity: 2026-05-08
- Plans completed: 01-01, 01-02, 01-03
- Decisions: FOLIO_PREFIX corregido (13 keys correctos), Prisma client sincronizado, Building3D limpio

## Phase Status

| Phase | Name | Status |
|-------|------|--------|
| 1 | Seguridad y Estabilidad | ✅ Complete (3/3 plans) |
| 2 | Features Pendientes — Procesos y Flujos | ✅ Complete (5/5 plans, 14/14 verified) |
| 3 | Roles y Áreas de Soporte | ✅ Complete (5/5 plans, incl. gap closure 03-05) |
| 4 | Métricas Operacionales | 🔄 In progress (1/4 plans) |
| 5 | Reportes Exportables | 🔲 Pending |

## Key Context

- Codebase map: `.planning/codebase/` (7 docs, generado 2026-05-06)
- Critical security issues: JWT hardcoded secret, OTP plain text, CORS open
- DB pendiente: `npm run db:generate` (migración permisos)
- UI real: MUI v6 (no shadcn/ui en páginas activas)

## GSD Config

- Mode: yolo
- Parallelization: true
- Model profile: quality
- Research: enabled
- Plan check: enabled
