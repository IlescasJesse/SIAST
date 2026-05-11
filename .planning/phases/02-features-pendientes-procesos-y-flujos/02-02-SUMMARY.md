---
phase: 02-features-pendientes-procesos-y-flujos
plan: "02"
subsystem: tickets-service
tags:
  - tickets
  - proceso-definicion
  - bug-fix
  - guards
dependency_graph:
  requires:
    - 02-01  # ProcesoDefinicion DB seed con DIRECTO
  provides:
    - tickets.service crearTicket usa ProcesoDefinicion DB
    - 6 guards/fixes D-08 a D-13 activos
  affects:
    - apps/api/src/services/tickets.service.ts
tech_stack:
  added: []
  patterns:
    - prisma.procesoDefinicion.findFirst con activo:true como fuente de verdad
    - Object.assign(new Error(), { status }) para errores HTTP tipados
key_files:
  modified:
    - apps/api/src/services/tickets.service.ts
decisions:
  - "D-09 validacion identidad tecnico: tecnicoId !== null && tecnicoId !== user.id — si null, cualquier tecnico con rol correcto puede completar (conservador)"
  - "D-08 siguientePaso query: orden > actual + not COMPLETADO, no orden exacto + PENDIENTE — permite pasos EN_PROGRESO intercalados"
metrics:
  duration: "~20min"
  completed_date: "2026-05-11"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 02 Plan 02: Tickets Service DB Migration and Bug Fixes Summary

**One-liner:** tickets.service usa ProcesoDefinicion DB en crearTicket + 6 guards D-08/D-09/D-10/D-11/D-12/D-13 aplicados para flujo multi-tecnico correcto.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Migrar crearTicket a ProcesoDefinicion DB y aplicar D-11 | 3844108 | tickets.service.ts |
| 2 | Aplicar guards D-08 D-09 D-10 D-12 D-13 | 3844108 | tickets.service.ts |

> Note: Tasks 1 and 2 committed together as 3844108 on worktree-agent branch (both were unapplied on this branch).

## Changes Applied

### Task 1 — DB Migration + D-11

- **D-01/D-04 — import:** Eliminado `getProcesoInfo` de `@stf/shared`. Solo `FOLIO_PREFIX` importado.
- **D-01 — crearTicket:** Reemplazado `getProcesoInfo(subcategoriaVal, body.subTipo)` por `prisma.procesoDefinicion.findFirst({ where: { subcategoria, subTipo, activo: true }, include: { pasos } })`. DB es ahora la única fuente de verdad para procesos.
- **D-11 — listarTickets:** Bloque técnico ahora agrega `where.estado = { notIn: ["RESUELTO", "CANCELADO"] }`. Si técnico pasa `?estado=RESUELTO` explícitamente, el override de línea siguiente lo permite.

### Task 2 — Guards y Bug Fixes

- **D-12 — asignarTicket:** Guard antes de buscar técnico: si `pasoTicket.findMany` retorna registros, throw 400 "Este ticket usa flujo de pasos. Asignar técnico desde el panel de pasos."
- **D-10 — cambiarEstado:** Guard antes de `fechas`: si `body.estado === "RESUELTO"` y hay pasos con `estado != COMPLETADO`, throw 400 "El ticket tiene pasos pendientes. Completa todos los pasos para resolver."
- **D-09 — completarPaso:** Guard de identidad antes del check de rol: `paso.tecnicoId !== null && paso.tecnicoId !== user.id` → 403 "Solo el técnico asignado puede completar este paso". Si tecnicoId es null, cualquier tecnico con rol correcto puede completar.
- **D-08 — completarPaso siguientePaso:** Query cambiada de `{ orden: paso.orden + 1, estado: "PENDIENTE" }` a `{ orden: { gt: paso.orden }, estado: { not: "COMPLETADO" }, orderBy: { orden: "asc" } }`. Previene falso "no hay siguiente" si un paso fue saltado o está EN_PROGRESO.
- **D-13 — completarPaso historial:** Antes del `ticket.update({ estado: "RESUELTO" })`, lee `ticketPreResolve.estado` para usar como `estadoAnteriorReal`. Elimina hardcoding de `"EN_PROGRESO"` en historialTicket y emitirCambioEstado.

## Deviations from Plan

None — plan executed exactly as written. Tasks 1 and 2 committed as single commit (3844108) on worktree-agent branch since both were unapplied.

## Known Stubs

None — all changes are functional guards and bug fixes with no placeholder data.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: mitigated T-02-02-01 | tickets.service.ts | D-09: tecnicoId identity check — 403 if assigned technician != requesting user |
| threat_flag: mitigated T-02-02-02 | tickets.service.ts | D-10: RESUELTO bypass guard — 400 if pending steps exist |
| threat_flag: mitigated T-02-02-03 | tickets.service.ts | D-12: asignarTicket step-flow guard — 400 if ticket has existing steps |
| threat_flag: mitigated T-02-02-04 | tickets.service.ts | D-01: procesoDefinicion.findFirst always includes activo:true |

## Self-Check: PASSED

- [x] apps/api/src/services/tickets.service.ts modified and committed (3844108)
- [x] commit 3844108 exists: `git log --all | grep 3844108` confirms
- [x] TypeScript: `npx tsc --noEmit -p apps/api/tsconfig.json` — no errors
- [x] getProcesoInfo: count = 0 (eliminated)
- [x] procesoDefinicion.findFirst: present at line 248
- [x] notIn RESUELTO/CANCELADO: line 80
- [x] D-12 guard: "Este ticket usa flujo de pasos" — count = 1
- [x] D-10 guard: "El ticket tiene pasos pendientes" — count = 1
- [x] D-09 guard: "Solo el tecnico asignado puede completar este paso" — count = 1
- [x] D-08 fix: `estado: { not: "COMPLETADO" }` in siguientePaso — line 527
- [x] D-13 fix: estadoAnteriorReal — lines 538, 548, 556 (no hardcoded EN_PROGRESO in completarPaso)
