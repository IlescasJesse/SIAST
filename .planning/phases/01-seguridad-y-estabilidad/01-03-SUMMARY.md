---
phase: 01-seguridad-y-estabilidad
plan: "03"
subsystem: shared-stability
tags: [prisma, folio-prefix, stability, stale-cleanup]
one_liner: "Prisma client regenerado con schema actual y FOLIO_PREFIX corregido: 5 keys stale de TECNOLOGIAS eliminados/corregidos, CUENTAS_DOMINIO agregado (TEC-DOM)"
dependency_graph:
  requires:
    - "01-01: startup env validation, CORS allowlist"
    - "01-02: rate limiting, login-rfc eliminado, session verification"
  provides:
    - "FOLIO_PREFIX con 13 keys correctos para SubcategoriaTicket actual"
    - "Prisma client sincronizado con migración unify_tecnico_ti_role"
  affects:
    - packages/shared/src/index.ts
    - packages/database (Prisma client generado)
tech_stack:
  added: []
  patterns:
    - "FOLIO_PREFIX keys compuestos categoria-subcategoria exactos al enum SubcategoriaTicket"
key_files:
  created: []
  modified:
    - packages/shared/src/index.ts
decisions:
  - "FOLIO_PREFIX reemplazado completamente con 13 keys correctos — 5 tecnología, 3 servicios, 5 recursos materiales"
  - "Prisma client regenerado via npm run db:generate en packages/database"
  - "Building3D auditado — STB-03 no-op, solo contiene BuildingViewer.jsx"
metrics:
  duration_minutes: 10
  completed_date: "2026-05-08"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 1
requirements_satisfied:
  - STB-01
  - STB-02
  - STB-03
---

# Phase 01 Plan 03: Deuda Técnica de Estabilidad — Summary

**One-liner:** Prisma client regenerado con schema actual y FOLIO_PREFIX corregido: 5 keys stale de TECNOLOGIAS eliminados/corregidos, CUENTAS_DOMINIO agregado (TEC-DOM).

## What Was Built

### STB-01: Prisma client regenerado

Ejecutado `npm run db:generate` en `packages/database`. El cliente Prisma v5.22.0 fue regenerado en `node_modules/@prisma/client` sincronizado con el schema actual que incluye la migración `20260429180311_unify_tecnico_ti_role`. Sin errores.

### STB-02: FOLIO_PREFIX corregido en packages/shared/src/index.ts

El mapa `FOLIO_PREFIX` fue reemplazado completamente. Cambios aplicados:

| Key anterior | Key correcto | Prefix | Acción |
|---|---|---|---|
| `TECNOLOGIAS-SISTEMAS` | `TECNOLOGIAS-SISTEMAS_INSTITUCIONALES` | TEC-SIS | Corregido |
| `TECNOLOGIAS-SOPORTE_TECNICO` | `TECNOLOGIAS-EQUIPOS_DISPOSITIVOS` | TEC-EQP | Corregido + nuevo prefix |
| `TECNOLOGIAS-REDES_INTERNET` | `TECNOLOGIAS-RED_INTERNET` | TEC-RED | Corregido |
| `TECNOLOGIAS-CONFIGURACION_CORREO_OUTLOOK` | `TECNOLOGIAS-CORREO_OUTLOOK` | TEC-COR | Corregido |
| `TECNOLOGIAS-IMPRESORAS` | — | — | Eliminado (subcategoría inexistente) |
| _(faltaba)_ | `TECNOLOGIAS-CUENTAS_DOMINIO` | TEC-DOM | Agregado nuevo |

Los tickets ya en DB conservan sus folios string existentes (`TIC-0001`, etc.) — el cambio solo afecta la generación de folios nuevos.

### STB-03: Building3D auditado

El directorio `apps/web/src/components/Building3D/` contiene únicamente `BuildingViewer.jsx`. No hay archivos stale. STB-03 es no-op — nada que eliminar.

## Commits

| Hash | Descripción |
|------|-------------|
| `db19082` | fix(01-03): regenerar Prisma client y corregir FOLIO_PREFIX (STB-01, STB-02) |

## Deviations from Plan

None — plan ejecutado exactamente como especificado.

## Known Stubs

Ninguno. Los cambios son correcciones de datos/configuración — sin placeholders ni dead data paths.

## Threat Flags

Ninguna superficie nueva introducida. Este plan solo corrige datos de configuración internos.

## Self-Check: PASSED

- `packages/shared/src/index.ts` verificado con 12 checks automatizados — todos PASS
- `Building3D/` verificado — `BuildingViewer.jsx` existe, sin extensiones stale
- Commit `db19082` confirmado en git log
- Prisma client generado sin errores
