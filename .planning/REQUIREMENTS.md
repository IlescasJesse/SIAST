# Requirements: SIAST

**Defined:** 2026-05-06
**Core Value:** Solicitud abierta → técnico la resuelve → trazabilidad completa, en tiempo real.

## Milestone 1: Seguridad + Estabilidad

### Seguridad Crítica

- [ ] **SEC-01**: JWT secret leído de `JWT_SECRET` env var — eliminar fallback hardcodeado
- [ ] **SEC-02**: OTP nunca retornado en HTTP response — solo enviado por WhatsApp
- [ ] **SEC-03**: CORS configurado con lista blanca de orígenes — no `true` en ningún env
- [ ] **SEC-04**: Rate limiting en endpoints de auth (login, OTP, refresh)
- [ ] **SEC-05**: Token refresh verifica revocación de sesión antes de emitir nuevo token

### Estabilidad

- [ ] **STB-01**: Prisma client regenerado con campo `permisos` (migración ya aplicada)
- [ ] **STB-02**: FOLIO_PREFIX map actualizado con keys correctos para enum actual
- [ ] **STB-03**: Archivos 3D stale eliminados de `apps/web/src/components/Building3D/`

## Milestone 2: Features Pendientes

### Procesos y Flujos

- [x] **PRO-01**: Tickets creados leen definición de proceso desde `ProcesoDefinicion` DB (no PROCESO_MAP hardcodeado)
- [x] **PRO-02**: Flujo `SISTEMAS_INSTITUCIONALES:SIRH` completado con pasos y técnicos asignados
- [x] **PRO-03**: Flujo `SISTEMAS_INSTITUCIONALES:SIAST` completado con pasos y técnicos asignados
- [ ] **PRO-04** _(backlog / fase TBD)_: Escalamiento Recursos Materiales desde `MANTENIMIENTO_CORRECTIVO` vinculado — diferido por decisión en 02-CONTEXT.md; requiere diseño de flujo cross-sistema (SIAST-MANTENIMIENTO)

### Notificaciones

- [x] **NOT-01**: `ticket:paso_asignado` y `ticket:paso_listo` emitidos en todos los flujos nuevos
- [x] **NOT-02**: Historia/audit trail actualizado en asignación de recursos

## Milestone 3: Métricas y Reportes

### Métricas

- [ ] **MET-01**: Dashboard de métricas por área (tiempo de resolución, volumen, SLA)
- [ ] **MET-02**: Métricas por técnico (carga de trabajo, eficiencia)
- [ ] **MET-03**: Métricas por proceso/tipo (distribución de categorías, tiempos por subcategoría)
- [ ] **MET-04**: Indicadores en tiempo real (solicitudes activas, colas por área)

### Reportes

- [ ] **REP-01**: Reporte exportable PDF/Excel por rango de fechas
- [ ] **REP-02**: Reporte por área o técnico específico
- [ ] **REP-03**: Reporte de tendencias mensual

## Out of Scope

| Feature | Reason |
|---------|--------|
| App móvil nativa | Web responsive cubre el caso; presupuesto no justifica |
| Multi-tenancy | Sistema exclusivo para Secretaría de Finanzas Oaxaca |
| Integración SAP/ERP | No existe sistema ERP en esta dependencia actualmente |
| Tests automatizados exhaustivos | Deseables pero no bloqueantes para entregas actuales |

## Milestone 1 (continued): Roles y Áreas de Soporte

- [ ] **ROL-01**: 7 nuevos valores en enum `Rol`: `RESPONSABLE_TI`, `RESPONSABLE_REDES`, `RESPONSABLE_MANTENIMIENTO`, `RESPONSABLE_RECURSOS_MATERIALES`, `TECNICO_ELECTRICISTA`, `TECNICO_PLOMERO`, `TECNICO_MOVILIDAD` — en Prisma schema y en `RolSchema` Zod de `@stf/shared`
- [ ] **ROL-02**: Entidad `AreaSoporte` en DB con 4 áreas seed (TI, REDES, MANTENIMIENTO, RECURSOS_MATERIALES) y campo `areaSoporteId` en `Usuario`
- [ ] **ROL-03**: Backend: guards de área (`requireResponsableDeArea()`), extensión de `asignarTicket` + `cambiarEstado`, endpoint `GET /api/admin/areas-soporte`
- [ ] **ROL-04**: RESPONSABLE_* puede reasignar tickets entre técnicos de su área y cerrar/cancelar solicitudes de su área
- [x] **ROL-05**: `areaSoporteId` se deriva automáticamente del rol en backend (`ROL_AREA_MAP` en `usuarios.controller.ts`) — no se requiere selector manual en frontend. Decisión UAT 2026-05-25: selector explícito eliminado, área implícita por nombre de rol (RESPONSABLE_TI→TI, RESPONSABLE_REDES→REDES, etc.).

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 a SEC-05 | Phase 1 | Pending |
| STB-01 a STB-03 | Phase 1 | Pending |
| PRO-01 a PRO-03 | Phase 2 | ✅ Complete (2026-05-13) |
| PRO-04          | Backlog  | Diferido (fase TBD) |
| NOT-01 a NOT-02 | Phase 2 | ✅ Complete (2026-05-13) |
| ROL-01 a ROL-05 | Phase 3 | ✅ Complete (2026-05-25) |
| MET-01 a MET-04 | Phase 4 | Pending |
| REP-01 a REP-03 | Phase 4 | Pending |
