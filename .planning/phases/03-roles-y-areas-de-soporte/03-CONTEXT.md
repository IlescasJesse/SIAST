# Phase 3: Roles y Áreas de Soporte - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Reestructurar el sistema de roles para reflejar la organización real de soporte: 4 áreas funcionales (TI, REDES, MANTENIMIENTO, RECURSOS MATERIALES) con roles `RESPONSABLE_*` por área y técnicos especializados. Incluye nueva entidad `AreaSoporte` en DB, campo `areaSoporteId` en `Usuario`, y permisos específicos para responsables de área dentro de su dominio.

**Sin cambios a flujos de tickets** — las reglas de negocio existentes (2 tickets activos, soft delete, historialTicket) se mantienen.
**Sin UI de dashboard de métricas** — eso va en Phase 4.

Deliverables concretos:
- Roles nuevos en enum `Rol`: RESPONSABLE_TI, RESPONSABLE_REDES, RESPONSABLE_MANTENIMIENTO, RESPONSABLE_RECURSOS_MATERIALES, TECNICO_ELECTRICISTA, TECNICO_PLOMERO, TECNICO_MOVILIDAD
- TECNICO_SERVICIOS deprecado — no se borra del enum todavía (admin reasigna manualmente usuarios existentes)
- Entidad `AreaSoporte` en DB: { id, nombre, subcategorias[], rolesIncluidos[] }
- Seed: 4 AreaSoporte con sus subcategorías y roles mapeados
- `Usuario.areaSoporteId` opcional → vincula RESPONSABLE_* a su AreaSoporte
- Middleware/guards: RESPONSABLE_* solo accede a solicitudes de su AreaSoporte
- Panel Admin: al crear/editar usuario con rol RESPONSABLE_*, campo selector de AreaSoporte
- Endpoints de reasignación: RESPONSABLE_* puede mover ticket entre técnicos de su área
- RESPONSABLE_* puede cerrar/cancelar solicitudes de su área

</domain>

<decisions>
## Implementation Decisions

### Roles Nuevos (Prisma enum + @stf/shared)

- **D-01:** Agregar al enum `Rol` en `schema.prisma` y en `packages/shared/src/index.ts`: `RESPONSABLE_TI`, `RESPONSABLE_REDES`, `RESPONSABLE_MANTENIMIENTO`, `RESPONSABLE_RECURSOS_MATERIALES`, `TECNICO_ELECTRICISTA`, `TECNICO_PLOMERO`, `TECNICO_MOVILIDAD`. Total: 7 roles nuevos.
- **D-02:** `TECNICO_SERVICIOS` permanece en el enum pero se marca como deprecated en comentario. Los usuarios existentes con ese rol NO se migran automáticamente — el admin los reasigna manualmente desde el panel de usuarios. Sin script de migración automática.
- **D-03:** Jerarquía de acceso:
  ```
  ADMIN (acceso total)
    └── MESA_AYUDA (debajo de admin, amplio acceso de sistema)
    └── RESPONSABLE_* (debajo de MESA_AYUDA, scope = su AreaSoporte)
          └── TECNICO_* / GESTOR_* (scope = sus propios tickets/pasos)
  └── EMPLEADO (solo sus propias solicitudes)
  ```

### Entidad AreaSoporte

- **D-04:** Nueva tabla `AreaSoporte` en Prisma: `{ id Int @id @default(autoincrement()), nombre String @unique, subcategorias String[], rolesIncluidos String[] }`. `subcategorias` y `rolesIncluidos` se almacenan como arrays de strings (valores del enum como strings) — MySQL no soporta arrays nativos; usar `Json` o tabla de relación. Claude decide la implementación concreta (Json vs tabla).
- **D-05:** Seed inicial de 4 AreaSoporte:
  - **TI**: subcategorias=[SISTEMAS_INSTITUCIONALES, EQUIPOS_DISPOSITIVOS, CUENTAS_DOMINIO, CORREO_OUTLOOK], rolesIncluidos=[RESPONSABLE_TI, TECNICO_TI]
  - **REDES**: subcategorias=[RED_INTERNET], rolesIncluidos=[RESPONSABLE_REDES, TECNICO_REDES]
  - **MANTENIMIENTO**: subcategorias=[SANITARIOS, ILUMINACION, MOVILIDAD], rolesIncluidos=[RESPONSABLE_MANTENIMIENTO, TECNICO_ELECTRICISTA, TECNICO_PLOMERO, TECNICO_MOVILIDAD]
  - **RECURSOS_MATERIALES**: subcategorias=[SALA_JUNTAS, EQUIPO_AUDIOVISUAL, PRESTAMO_EQUIPO, MOBILIARIO, PAPELERIA], rolesIncluidos=[RESPONSABLE_RECURSOS_MATERIALES, GESTOR_RECURSOS_MATERIALES]
- **D-06:** `Usuario` agrega campo `areaSoporteId Int? @map("area_soporte_id")` con relación opcional a `AreaSoporte`. Solo relevante cuando `rol = RESPONSABLE_*`.

### Permisos de RESPONSABLE_*

- **D-07:** RESPONSABLE_* puede **reasignar** tickets entre técnicos de su área sin pasar por ADMIN. Nuevo endpoint o extensión de `asignarTicket`: verifica que el técnico destino tenga rol incluido en el `AreaSoporte` del responsable.
- **D-08:** RESPONSABLE_* puede **cerrar/cancelar** solicitudes de su área. Extensión de `cambiarEstado`: además de ADMIN, permitir RESPONSABLE_* si el ticket pertenece a su AreaSoporte (inferido por subcategoría del ticket).
- **D-09:** RESPONSABLE_* puede **ver métricas** de su área — acceso a `/api/metricas/*` filtrado por su AreaSoporte. Este filtrado se implementa en Phase 4; en Phase 3 solo se garantiza que el campo `areaSoporteId` existe para que Phase 4 lo consuma.

### Mapeo Técnicos ↔ Subcategorías (para ProcesoDefinicion)

- **D-10:** `TECNICO_ELECTRICISTA` atiende: `ILUMINACION`. `TECNICO_PLOMERO` atiende: `SANITARIOS`. `TECNICO_MOVILIDAD` atiende: `MOVILIDAD`. Seed de `ProcesoDefinicion` para estos tres nuevos subtipos usa los roles específicos (no TECNICO_SERVICIOS) en sus `PasoDefinicion.rolRequerido`.

### Panel Admin — Gestión de Usuarios

- **D-11:** En `UsuariosPage.jsx` o `AdminUsuariosPage.jsx` (verificar cuál gestiona creación), al seleccionar rol `RESPONSABLE_*`, mostrar campo adicional de selector de AreaSoporte. Campo obligatorio para roles RESPONSABLE_*. Para otros roles, el campo es oculto.

### Claude's Discretion

- Implementación concreta de `subcategorias` y `rolesIncluidos` en MySQL: Json vs tabla de relación separada `AreaSoporteSubcategoria` y `AreaSoporteRol`. Json es más simple para este caso de uso (4 áreas fijas, sin queries complejas sobre estos campos).
- Orden de validación en el middleware de RESPONSABLE_*: inferir AreaSoporte del token → leer areaSoporteId del usuario → comparar subcategoría del ticket. Si es costoso, cachear la AreaSoporte del usuario en el JWT o en un middleware singleton.
- Si `PasoDefinicion` ya tiene `TECNICO_SERVICIOS` como rolRequerido en pasos existentes, actualizar el seed para reemplazar con el subrole específico según la subcategoría.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap y Requisitos
- `.planning/ROADMAP.md` §Phase 3 — deliverables y UAT criteria
- `.planning/phases/02-features-pendientes-procesos-y-flujos/02-CONTEXT.md` — decisiones previas de flujo de pasos y ProcesoDefinicion

### Schema y Modelos
- `packages/database/prisma/schema.prisma` — enum `Rol`, modelo `Usuario`, modelos `ProcesoDefinicion` + `PasoDefinicion`; agregar `AreaSoporte` y campo `areaSoporteId` en Usuario
- `packages/shared/src/index.ts` — enum `Rol` en Zod, `SubcategoriaTicketSchema` (mapeos TI/REDES/MANTENIMIENTO/RECURSOS_MATERIALES)

### Backend — Archivos a Modificar
- `apps/api/src/middleware/roles.middleware.ts` — `requireRol()`: agregar nuevos roles; considerar middleware `requireResponsableDeArea()` para guards de área
- `apps/api/src/services/tickets.service.ts` — `asignarTicket`, `cambiarEstado`: extender para permisos RESPONSABLE_*
- `apps/api/src/controllers/usuarios.controller.ts` — CRUD de usuarios: incluir `areaSoporteId` en create/update cuando rol = RESPONSABLE_*
- `packages/database/prisma/seed.ts` — seed de `AreaSoporte` (4 áreas) + actualizar `PasoDefinicion` para subroles de MANTENIMIENTO

### Frontend — Archivos a Modificar
- `apps/web/src/pages/UsuariosPage.jsx` — verificar si aquí o en AdminUsuariosPage se gestiona creación de usuarios; agregar selector AreaSoporte para RESPONSABLE_*
- `apps/web/src/pages/AdminUsuariosPage.jsx` — alternativa para gestión de usuarios staff

### Arquitectura Real-Time
- `.planning/codebase/ARCHITECTURE.md` §Real-time Architecture — tabla eventos Socket.IO, rooms existentes; RESPONSABLE_* necesita room propia o usa `admins`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `requireRol(...roles)` en `apps/api/src/middleware/roles.middleware.ts` — base para nuevo middleware de área
- `Object.assign(new Error(msg), { status: N })` — patrón de error para guards nuevos
- `prisma.$transaction()` — seed atómico de AreaSoporte
- `apps/api/src/controllers/admin-procesos.controller.ts` — patrón CRUD + Prisma existente

### Established Patterns
- JWT payload incluye `{ id, rol, jti }` — no incluye `areaSoporteId`; el middleware debe leer DB para resolverlo (o extender el JWT al login del RESPONSABLE_*)
- Soft delete: `activo: true` en todos los queries — mantener en AreaSoporte
- Seed idempotente: upsert por unique constraint — AreaSoporte usa `nombre` como unique key

### Integration Points
- `apps/api/src/services/tickets.service.ts:asignarTicket` — extender guard para RESPONSABLE_*
- `apps/api/src/services/tickets.service.ts:cambiarEstado` — extender para permitir RESPONSABLE_* en su área
- `packages/database/prisma/seed.ts` — agregar `AreaSoporte` seed después de `ProcesoDefinicion` (ya existe ahí)
- Room Socket.IO para RESPONSABLE_*: decidir si usan room `admins` existente o room propia `responsable:{areaId}`

</code_context>

<specifics>
## Specific Ideas

- **4 áreas fijas definidas por el usuario:** TI, REDES, MANTENIMIENTO, RECURSOS_MATERIALES. No admin-configurable en v1.
- **TECNICO_SERVICIOS deprecated pero no eliminado:** preserva compatibilidad con datos históricos. Usuarios existentes con ese rol quedan funcionales hasta que admin los reasigne.
- **Subroles MANTENIMIENTO claros:** TECNICO_ELECTRICISTA → ILUMINACION, TECNICO_PLOMERO → SANITARIOS, TECNICO_MOVILIDAD → MOVILIDAD. Sin ambigüedad.
- **RESPONSABLE_* scope estricto:** solo ve y actúa sobre tickets cuya subcategoría pertenece a su AreaSoporte. Un RESPONSABLE_TI NO puede tocar un ticket de SANITARIOS.

</specifics>

<deferred>
## Deferred Ideas

- **Room Socket.IO dedicada para RESPONSABLE_***: puede ser `responsable:{areaId}` para notificaciones filtradas. Evaluar en Phase 4 cuando se implemente el dashboard de métricas en tiempo real.
- **RESPONSABLE_* como creador de tickets en nombre de empleados**: fuera de scope — eso es rol de MESA_AYUDA.
- **Más subroles en RECURSOS_MATERIALES (TECNICO_ALMACEN)**: mencionado en discusión pero no confirmado; diferir hasta que se identifique caso de uso específico.
- **Auto-asignación de técnico según subcategoría**: fuera de scope Phase 3.

</deferred>

---

*Phase: 3-Roles y Áreas de Soporte*
*Context gathered: 2026-05-13*
