# Project State

**Project:** SIAST — Sistema Integral de Atención y Soporte Técnico
**Initialized:** 2026-05-06
**Mode:** YOLO
**Current Milestone:** M1 — Sistema estable, seguro y con features completas

## Current Phase

**Phase 4: Métricas Operacionales** — COMPLETE (4/4 plans executed 2026-05-26)

- Status: Complete (Plan 04 executed 2026-05-26)
- Decisions: Recharts, SLA fijo, endpoint único, tabs en DashboardPage, ticketsVersion pattern
- Plan 01 decisions: areaSoporteId nullable sin @relation (integridad histórica), columnas tipadas sobre JSON monolítico, tipos legacy conservados para retrocompatibilidad
- Plan 02 decisions: JWT de staff incluye areaSoporteId para RESPONSABLE*\* scoping; TECNICO_SERVICIOS excluido (no en enum Rol); RESPONSABLE*\* areaId siempre del JWT; funciones legacy eliminadas del controlador
- Plan 03 decisions: recharts hoisted monorepo root (npm workspaces), AdapterDateFns sobre AdapterDayjs, Box height=260 Bar/Line + 220 Pie, Tooltip antes Legend z-order obligatorio
- Plan 04 decisions: tipoFromTab area/tecnico/proceso, userId fallback para TECNICO\_\* en tab inicial, setInterval .unref() para job diario, upsert idempotente via @@unique([fecha, areaSoporteId])
- Next: Phase 5 — Reportes Exportables

## Completed Phases

**Phase 3: Roles y Áreas de Soporte** — COMPLETE (incl. gap closure)

- Status: Complete (2026-05-25, gap closure 03-05 ejecutado)
- Plans: 5 (03-01 a 03-05) — schema, seed, backend, frontend + gap closure validaciones
- All 5 plans executed on main. API + Web build verified.
- Decisions: 14 roles, 4 AreaSoporte, areaSoporteId en Usuario, guards RESPONSABLE\_\*, fieldErrors por campo en formularios usuario, validación 400 antes de Prisma

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

| Phase | Name                                    | Status                                           |
| ----- | --------------------------------------- | ------------------------------------------------ |
| 1     | Seguridad y Estabilidad                 | ✅ Complete (3/3 plans)                          |
| 2     | Features Pendientes — Procesos y Flujos | ✅ Complete (5/5 plans, 14/14 verified)          |
| 3     | Roles y Áreas de Soporte                | ✅ Complete (5/5 plans, incl. gap closure 03-05) |
| 4     | Métricas Operacionales                  | ✅ Complete (4/4 plans)                          |
| 5     | Reportes Exportables                    | 🔲 Pending                                       |

## Key Context

- Codebase map: `.planning/codebase/` (7 docs, generado 2026-05-06)
- Critical security issues: ✅ RESUELTOS (verificado 2026-06-10) — JWT exige env var, OTP hasheado con bcrypt (commit ce6cbe6), CORS con whitelist
- DB pendiente: `npm run db:generate` (migración permisos)
- UI real: MUI v6 (no shadcn/ui en páginas activas)

## GSD Config

- Mode: yolo
- Parallelization: true
- Model profile: quality
- Research: enabled
- Plan check: enabled
