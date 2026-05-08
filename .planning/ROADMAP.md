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

## Phase 2: Features Pendientes — Procesos y Flujos

**Goal:** ProcesoDefinicion DB operativa; flujos SIRH/SIAST activos; escalamiento RM vinculado.
**Requirements:** PRO-01 a PRO-04, NOT-01 a NOT-02
**Depends on:** Phase 1 complete

### Deliverables
- Tickets leen proceso desde DB (`ProcesoDefinicion`) en lugar de `PROCESO_MAP` hardcodeado
- Admin puede crear/editar procesos y los tickets los respetan inmediatamente
- Flujo SISTEMAS_INSTITUCIONALES:SIRH: pasos definidos, técnicos asignables
- Flujo SISTEMAS_INSTITUCIONALES:SIAST: pasos definidos, técnicos asignables
- Escalamiento Recursos Materiales desde MANTENIMIENTO_CORRECTIVO vinculado a paso SIAST
- Socket.IO events emitidos correctamente en todos los flujos nuevos

### UAT
- Admin edita pasos de proceso → nuevo ticket usa definición actualizada
- Técnico SIRH puede ser asignado a paso SISTEMAS_INSTITUCIONALES:SIRH
- Escalamiento de mantenimiento correctivo genera paso en cola de SIAST

---

## Phase 3: Métricas Operacionales

**Goal:** Dashboard de métricas en tiempo real para administradores y jefes de área.
**Requirements:** MET-01 a MET-04
**Depends on:** Phase 2 complete

### Deliverables
- Endpoints GET /api/metricas/{area,tecnico,proceso} funcionales
- Dashboard /metricas con cards: solicitudes activas, tiempo promedio resolución, carga por técnico
- Métricas por área con filtro de rango de fechas
- Actualización en tiempo real via Socket.IO (mismo ticketsVersion pattern)

### UAT
- Admin ve dashboard con datos reales de los últimos 30 días
- Métricas se actualizan sin recargar cuando se completa una solicitud
- Filtro por área muestra solo solicitudes de esa área

---

## Phase 4: Reportes Exportables

**Goal:** Generación de reportes PDF/Excel para informes gubernamentales.
**Requirements:** REP-01 a REP-03
**Depends on:** Phase 3 complete

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

---

## Phase Dependency Graph

```
Phase 1 (Seguridad)
    └── Phase 2 (Procesos)
            └── Phase 3 (Métricas)
                    └── Phase 4 (Reportes)
```
