# Project State

**Project:** SIAST — Sistema Integral de Atención y Soporte Técnico
**Initialized:** 2026-05-06
**Mode:** YOLO
**Current Milestone:** M1 — Sistema estable, seguro y con features completas

## ⚠️ Nota (2026-09-14): este archivo estaba desactualizado desde 2026-06-13

Entre el 13-jun y el 31-ago-2026 hubo ~24 commits de "feedback de staff"
(P1/P2/P3) directamente sobre `apps/api`/`apps/web`/`packages` **fuera del
flujo GSD** — no quedaron registrados aquí. Puntos concretos que este
archivo tenía mal:

- "Backend con mock data en memoria" (CLAUDE.md) — **falso**, todo usa Prisma.
- "14 roles" — el enum `Rol` tiene **20 valores** hoy (se agregaron
  `GESTOR_SALAS_JUNTA`, `GESTOR_RECURSOS`, `GESTOR_INVENTARIO`,
  `RESPONSABLE_SISTEMAS`, `TECNICO_SISTEMAS`).
- El repo estuvo 2 semanas sin actividad (31-ago → 14-sep) antes de esta sesión.

El PR [#2](https://github.com/IlescasJesse/SIAST/pull/2) de esta sesión
(2026-09-14) corrigió, fuera de fase también (son bugs/deuda técnica, no
feature nueva): fuga de PII en `GET /me`, permisos faltantes de
`GESTOR_SALAS_JUNTA`/`GESTOR_RECURSOS`/`GESTOR_INVENTARIO` en
`/api/recursos`, `adscripcionNombre`/`adscripcionNivel` que Zod
descartaba, ubicación de empleados dados de baja expuesta, ruta
`/api/employee/location` faltante, `recursosAdicionales` invisible en
`SolicitudDetailPage`, seed sin usuarios de prueba por rol, y ESLint
configurado en los 6 workspaces (antes `npm run lint` no hacía nada).
Además `npm audit fix` bajó las vulnerabilidades de dependencias de 39 a 13
(quedan 5 paquetes que requieren breaking changes, pendientes de decisión).

## Current Phase

**Phase 4: Métricas Operacionales** — COMPLETE (4/4 plans executed 2026-05-26)

- Status: Complete (Plan 04 executed 2026-05-26)
- Decisions: Recharts, SLA fijo, endpoint único, tabs en DashboardPage, ticketsVersion pattern
- Plan 01 decisions: areaSoporteId nullable sin @relation (integridad histórica), columnas tipadas sobre JSON monolítico, tipos legacy conservados para retrocompatibilidad
- Plan 02 decisions: JWT de staff incluye areaSoporteId para RESPONSABLE*\* scoping; TECNICO_SERVICIOS excluido (no en enum Rol); RESPONSABLE*\* areaId siempre del JWT; funciones legacy eliminadas del controlador
- Plan 03 decisions: recharts hoisted monorepo root (npm workspaces), AdapterDateFns sobre AdapterDayjs, Box height=260 Bar/Line + 220 Pie, Tooltip antes Legend z-order obligatorio
- Plan 04 decisions: tipoFromTab area/tecnico/proceso, userId fallback para TECNICO\_\* en tab inicial, setInterval .unref() para job diario, upsert idempotente via @@unique([fecha, areaSoporteId])
- Next: Phase 5 — Reportes Exportables (no iniciada; ver nota arriba sobre trabajo P1-P3 hecho fuera de fase entre Phase 4 y hoy)

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
