# Roadmap: SIAST — Milestone 1

**Milestone:** M1 — Sistema estable, seguro y con features completas
**Goal:** De sistema con deuda técnica y features incompletas → plataforma segura, completa y con métricas operacionales.

---

## Phase 1: Seguridad y Estabilidad

**Goal:** Eliminar vulnerabilidades críticas y deuda técnica bloqueante.
**Requirements:** SEC-01 a SEC-05, STB-01 a STB-03
**Estimated effort:** 1-2 días
**Plans:** 3 planes

### Plans
- [x] 01-01-PLAN.md — Seguridad backend core: JWT sin fallback, CORS allowlist, OTP sin devCodigo, CSPRNG
- [x] 01-02-PLAN.md — Rate limiting + legacy cleanup: authRateLimiter, eliminar login-rfc, refreshToken con verificarSesion
- [x] 01-03-PLAN.md — Estabilidad: Prisma client sync, FOLIO_PREFIX corregido, Building3D audit

### Deliverables
- JWT secret forzado desde env var (sin fallback)
- OTP nunca expuesto en HTTP response
- CORS con lista blanca de orígenes configurada
- Rate limiting en auth endpoints
- Refresh token verifica revocación
- `npm run db:generate` ejecutado, Prisma client sincronizado
- FOLIO_PREFIX corregido para enum actual
- Archivos Building3D stale eliminados

### UAT
- Login falla si `JWT_SECRET` no está en env (no usa fallback)
- OTP no aparece en response body bajo ninguna condición
- Request desde origen no whitelisted → 403
- 6+ intentos de login → rate limited

---

## Phase 2: Features Pendientes — Procesos y Flujos ✅ Complete (2026-05-13)

**Goal:** ProcesoDefinicion DB operativa; flujos SIRH/SIAST activos; audit trail completo en pasos.
**Requirements:** PRO-01 a PRO-03, NOT-01 a NOT-02
**Depends on:** Phase 1 complete
**Plans:** 5 planes (4 base + 1 gap closure)
**Verification:** 14/14 must-haves passed

### Plans
- [x] 02-01-PLAN.md — Seed ProcesoDefinicion: SIRH y SIAST como flujos DIRECTO en DB
- [x] 02-02-PLAN.md — tickets.service.ts: migrar a DB + 6 bug fixes de flujo de pasos
- [x] 02-03-PLAN.md — metricas.controller.ts: migrar a DB, eliminar PROCESO_MAP import
- [x] 02-04-PLAN.md — Limpieza final: eliminar PROCESO_MAP de @stf/shared + seed autónomo
- [x] 02-05-PLAN.md — Gap closure: PRO-04 al backlog + historialTicket en asignarPaso (NOT-02)

### Deliverables
- Tickets leen proceso desde DB (`ProcesoDefinicion`) en lugar de `PROCESO_MAP` hardcodeado
- Admin puede crear/editar procesos y los tickets los respetan inmediatamente
- Flujo SISTEMAS_INSTITUCIONALES:SIRH: pasos definidos, técnicos asignables
- Flujo SISTEMAS_INSTITUCIONALES:SIAST: pasos definidos, técnicos asignables
- Socket.IO events emitidos correctamente en todos los flujos nuevos
- `asignarPaso()` registra audit trail en `historialTicket` con técnico asignado y paso

### UAT
- Admin edita pasos de proceso → nuevo ticket usa definición actualizada
- Técnico SIRH puede ser asignado a paso SISTEMAS_INSTITUCIONALES:SIRH
- Asignación de técnico a paso queda registrada en historialTicket con comentario de auditoría

---

## Phase 3: Roles y Áreas de Soporte

**Goal:** Reestructurar el sistema de roles para reflejar la organización real de soporte: 4 áreas (TI, REDES, MANTENIMIENTO, RECURSOS MATERIALES) con responsables y técnicos especializados.
**Requirements:** ROL-01 a ROL-05
**Depends on:** Phase 2 complete
**Plans:** 4 planes

### Plans
- [ ] 03-01-PLAN.md — Schema + shared types: enum Rol extendido (14 valores), modelo AreaSoporte, PERMISOS_DEFAULT actualizado
- [ ] 03-02-PLAN.md — Migración DB + seed: migrate dev, 4 AreaSoporte seeds, 3 ProcesoDefinicion MANTENIMIENTO
- [ ] 03-03-PLAN.md — Backend guards: requireResponsableDeArea(), asignarTicket/cambiarEstado/listarTickets, bug fix crearTicket, endpoint GET /areas-soporte
- [ ] 03-04-PLAN.md — Frontend: selector AreaSoporte condicional en UsuariosPage + AdminUsuariosPage, getAreasSoporte API helpers

### Deliverables
- 4 nuevos roles RESPONSABLE_*: RESPONSABLE_TI, RESPONSABLE_REDES, RESPONSABLE_MANTENIMIENTO, RESPONSABLE_RECURSOS_MATERIALES
- 3 nuevos roles técnicos de MANTENIMIENTO: TECNICO_ELECTRICISTA, TECNICO_PLOMERO, TECNICO_MOVILIDAD (reemplazan TECNICO_SERVICIOS)
- Entidad `AreaSoporte` en DB con subcategorías y roles mapeados por área
- Campo `areaSoporteId` en `Usuario` para vincular RESPONSABLE_* a su área
- RESPONSABLE_* puede: reasignar solicitudes entre técnicos de su área, cerrar/cancelar solicitudes de su área, ver métricas de su área
- Panel de usuarios actualizado: asignación de área al crear/editar RESPONSABLE_*
- TECNICO_SERVICIOS marcado deprecated — admin reasigna manualmente a subroles específicos

### UAT
- Admin crea usuario RESPONSABLE_TI asignado al AreaSoporte TI
- RESPONSABLE_TI ve solo tickets de subcategorías TI (SISTEMAS_INSTITUCIONALES, EQUIPOS_DISPOSITIVOS, CUENTAS_DOMINIO, CORREO_OUTLOOK)
- RESPONSABLE_TI reasigna un ticket de TECNICO_TI_A a TECNICO_TI_B sin pasar por admin
- RESPONSABLE_MANTENIMIENTO ve tickets SANITARIOS, ILUMINACION, MOVILIDAD pero NO tickets de TI

---

## Phase 4: Métricas Operacionales

**Goal:** Dashboard de métricas en tiempo real para administradores y responsables de área.
**Requirements:** MET-01 a MET-04
**Depends on:** Phase 3 complete

### Deliverables
- Endpoints GET /api/metricas/{area,tecnico,proceso} funcionales con AreaSoporte
- Sección métricas en DashboardPage (visible para ADMIN y RESPONSABLE_*)
- ADMIN: métricas globales de todas las áreas + índice de solvencia comparativo + gráficas
- RESPONSABLE_*: métricas filtradas a su área: solicitudes, carga de técnicos, tiempo resolución
- Filtro de rango de fechas en todas las vistas de métricas
- Actualización en tiempo real via Socket.IO (ticketsVersion pattern)

### UAT
- Admin ve dashboard con datos reales de los últimos 30 días de todas las áreas
- RESPONSABLE_TI ve solo métricas de tickets TI y sus técnicos TI
- Métricas se actualizan sin recargar cuando se completa una solicitud
- Filtro por fecha muestra solo solicitudes del rango seleccionado

---

## Phase 5: Reportes Exportables

**Goal:** Generación de reportes PDF/Excel para informes gubernamentales.
**Requirements:** REP-01 a REP-03
**Depends on:** Phase 4 complete

### Deliverables
- Endpoint POST /api/reportes con parámetros de filtro (fecha, área, técnico)
- Reporte PDF con resumen ejecutivo y tabla de solicitudes
- Reporte Excel con datos tabulares completos
- UI en /admin con selector de filtros y botón de descarga

### UAT
- Admin genera reporte del mes anterior → descarga PDF con solicitudes y tiempos
- Reporte Excel contiene todas las columnas: folio, área, técnico, categoría, tiempos
- Reporte por técnico específico muestra solo sus solicitudes

---

## Backlog (v2)

- Tests automatizados (Jest + Supertest para API crítica)
- Autenticación 2FA para staff con permisos elevados
- Integración con directorio LDAP/AD (si Secretaría lo implementa)
- packages/ui shadcn conectado y unificado con MUI
- **PRO-04 (diferido)**: Escalamiento Recursos Materiales desde `MANTENIMIENTO_CORRECTIVO` vinculado a paso SIAST — requiere diseño de flujo cross-sistema (SIAST-MANTENIMIENTO); diferido en fase 2 por decisión en 02-CONTEXT.md; fase TBD

---

## Phase Dependency Graph

```
Phase 1 (Seguridad)
    └── Phase 2 (Procesos)
            └── Phase 3 (Roles y Áreas de Soporte)
                    └── Phase 4 (Métricas Operacionales)
                            └── Phase 5 (Reportes)
```
