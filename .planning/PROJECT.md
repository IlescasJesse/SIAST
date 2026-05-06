# SIAST — Sistema Integral de Atención y Soporte Técnico

## What This Is

Sistema de gestión de solicitudes de soporte técnico para la Secretaría de Finanzas del Estado de Oaxaca (Edificio Saúl Martínez). Permite a empleados reportar incidencias vía RFC, a técnicos gestionar flujos de atención multi-paso, y a administradores configurar procesos y permisos granulares. Incluye un visor 3D del edificio para localización de áreas.

## Core Value

Que un empleado pueda abrir una solicitud y un técnico pueda resolverla con trazabilidad completa — en tiempo real, sin recargar la página.

## Requirements

### Validated

- [x] Autenticación dual: RFC-only para empleados, usuario+contraseña para staff
- [x] CRUD de solicitudes con máximo 2 activas por empleado
- [x] Soft delete (`activo = false`)
- [x] Sistema de procesos multi-paso con asignación de técnicos por paso
- [x] Notificaciones en tiempo real vía Socket.IO
- [x] Módulo de administración con permisos granulares
- [x] Visor 3D del edificio (Three.js, iframe en port 5174)
- [x] Sincronización SIRH (1994 empleados, RFC-based)

### Active

- [ ] Corregir vulnerabilidades de seguridad críticas (JWT, OTP, CORS)
- [ ] Conectar ProcesoDefinicion DB con creación de tickets (actualmente ignorado)
- [ ] Activar flujos SISTEMAS_INSTITUCIONALES:SIRH y :SIAST
- [ ] Implementar Escalamiento Recursos Materiales
- [ ] Dashboard de métricas por área/técnico/proceso
- [ ] Generación de reportes exportables
- [ ] Fix FOLIO_PREFIX stale keys (tickets TI usan fallback TIC-)
- [ ] Regenerar cliente Prisma (migración unify_tecnico_ti_role pendiente)

### Out of Scope

- Integración con sistemas externos distintos a SIRH — complejidad no justificada en v1
- App móvil — web responsive cubre el caso de uso actual
- Multi-tenancy — sistema para una sola dependencia gubernamental

## Context

- **Stack**: Express 5 + TypeScript + Prisma + MySQL (XAMPP) + Socket.IO | Vite + React + MUI v6 | Three.js 3D viewer
- **Monorepo**: npm workspaces — apps/api (5101), apps/web (5173), apps/modelado-3d (5174), packages/{shared,ui,database}
- **Auth**: JWT access+refresh. Empleados: RFC único. Staff: user+pass.
- **Real-time**: Socket.IO rooms `admins`, `user:{id}`, `emp:{rfc}` + ticketsVersion counter en Zustand
- **DB pendiente**: `npm run db:generate` — Prisma client desincronizado con migración permisos
- **UI real**: MUI v6 en apps/web. packages/ui tiene shadcn components pero no se usan en páginas.

## Constraints

- **Tech**: MySQL via XAMPP — no cambiar motor de BD
- **Auth gov**: Empleados autentican SOLO con RFC (sistema SIRH no tiene contraseñas)
- **Performance**: Max 2 tickets activos/empleado — regla de negocio, no técnica
- **Deploy**: VPS con PM2 — sin Docker ni Kubernetes

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| MUI v6 en web | Ya instalado y usado en todas las páginas | ✓ Mantener |
| packages/ui shadcn | Definido pero no conectado a páginas | ⚠️ Revisar |
| Soft delete en tickets | Auditoría gubernamental requiere historial | ✓ Mantener |
| Socket.IO ticketsVersion counter | Patrón para forzar refetch desde eventos socket | ✓ Mantener |
| PROCESO_MAP hardcodeado | ProcesoDefinicion DB existe pero no se usa | ⚠️ Conectar en Phase 2 |

---
*Last updated: 2026-05-06 — inicialización GSD*
