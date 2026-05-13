---
phase: 02-features-pendientes-procesos-y-flujos
plan: "05"
subsystem: tickets-service / planning-docs
tags: [gap-closure, audit-trail, historialTicket, backlog, PRO-04, NOT-02]
dependency_graph:
  requires: []
  provides: [audit-trail-asignarPaso, PRO-04-backlog-documented]
  affects: [apps/api/src/services/tickets.service.ts, .planning/ROADMAP.md, .planning/REQUIREMENTS.md]
tech_stack:
  added: []
  patterns: [historialTicket.create para audit trail de acciones de servicio]
key_files:
  created: []
  modified:
    - apps/api/src/services/tickets.service.ts
decisions:
  - PRO-04 diferido explícitamente al Backlog con nota de fase TBD y razón (diseño cross-sistema)
  - historialTicket.create insertado entre ticket.update y emitirPasoAsignado para preservar orden causal
metrics:
  duration: "~10 min"
  completed: "2026-05-13T16:55:49Z"
  tasks_completed: 2
  files_modified: 1
---

# Phase 2 Plan 05: Gap Closure — PRO-04 Backlog + NOT-02 historialTicket en asignarPaso

**One-liner:** Audit trail de asignación de técnico a paso via `historialTicket.create` en `asignarPaso()`, y PRO-04 documentado en Backlog con diferimiento explícito.

## Summary

Este plan cierra los 2 gaps del reporte de verificación de Phase 2, llevando Phase 2 de 12/14 a 14/14 verdades verificadas.

**Gap 1 (PRO-04 documental):** PRO-04 ya estaba movido al Backlog en `ROADMAP.md` y `REQUIREMENTS.md` (aplicado en commit `8f17987` durante la creación del plan). Los archivos ya cumplían los criterios al inicio de la ejecución — no requirieron modificación adicional.

**Gap 2 (NOT-02 código):** `asignarPaso()` en `tickets.service.ts` no tenía `historialTicket.create`. Se agregó el registro de audit trail después de `prisma.ticket.update` y antes de `notif.emitirPasoAsignado`.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Mover PRO-04 al Backlog en ROADMAP.md y REQUIREMENTS.md | `8f17987` (ya aplicado) |
| 2 | Agregar `historialTicket.create` en `asignarPaso` (NOT-02) | `30ed9cc` |

## Changes Made

### Task 1: ROADMAP.md y REQUIREMENTS.md (ya aplicados)

- `ROADMAP.md` Phase 2 Deliverables y UAT: sin referencias a escalamiento RM
- `ROADMAP.md` Backlog: entrada `PRO-04 (diferido)` con nota de fase TBD y razón cross-sistema
- `REQUIREMENTS.md` PRO-04: marcado como `_(backlog / fase TBD)_` con nota de diferimiento
- `REQUIREMENTS.md` Traceability: `PRO-01 a PRO-03 | Phase 2 | Pending` y `PRO-04 | Backlog | Diferido (fase TBD)` como filas separadas

### Task 2: tickets.service.ts — asignarPaso (commit 30ed9cc)

Insertado en `asignarPaso()` entre `prisma.ticket.update` y `notif.emitirPasoAsignado` (línea 616):

```typescript
// Audit trail — NOT-02: registrar asignación de técnico a paso en historialTicket
await prisma.historialTicket.create({
  data: {
    ticketId,
    estadoAnterior: estadoAnteriorTicket as never,
    estadoNuevo: "EN_PROGRESO",
    usuarioId: user.id,
    comentario: `Paso ${paso.orden} — ${paso.nombre ?? `Paso ${paso.orden}`}: asignado a ${tecnico.nombre} ${tecnico.apellidos}`,
  },
});
```

## Verification Results

```
# Gap 1: escalamiento de mantenimiento correctivo en ROADMAP = 0 (OK)
grep -c "Escalamiento de mantenimiento correctivo" .planning/ROADMAP.md → 0

# Gap 1: PRO-04 en Backlog con nota de diferimiento (OK)
grep "PRO-04" .planning/ROADMAP.md → entrada en Backlog con fase TBD

# Gap 2: historialTicket.create en asignarPaso (OK)
grep -n "historialTicket.create" apps/api/src/services/tickets.service.ts → línea 616

# TypeScript compilation
cd apps/api && npx tsc --noEmit → 0 errores
```

## Deviations from Plan

**Task 1 — Estado previo:** Los cambios en ROADMAP.md y REQUIREMENTS.md ya estaban aplicados en commit `8f17987` (creado durante la sesión de planning del día anterior). No fue necesario modificar estos archivos nuevamente — los criterios de verificación ya se cumplían al inicio de la ejecución.

No hubo deviaciones de lógica ni cambios adicionales.

## Known Stubs

Ninguno — los cambios son completamente funcionales.

## Threat Flags

Ninguno — no se introdujeron nuevas superficies de red, auth paths ni schema changes. El `historialTicket.create` usa datos obtenidos de DB (no input del usuario), sin vector de inyección. Ver T-02gc-01 en el threat model del plan.

## Self-Check: PASSED

- `apps/api/src/services/tickets.service.ts` — FOUND (modificado)
- `.planning/ROADMAP.md` — FOUND (sin escalamiento RM en deliverables, PRO-04 en Backlog)
- `.planning/REQUIREMENTS.md` — FOUND (PRO-04 con nota backlog/fase TBD)
- Commit `30ed9cc` — FOUND
- TypeScript: 0 errores
