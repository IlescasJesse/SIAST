# Phase 3: Roles y Áreas de Soporte - Research

**Researched:** 2026-05-13
**Domain:** Prisma enum extension, MySQL JSON columns, Express middleware, MUI v6 form patterns
**Confidence:** HIGH — all findings verified directly from codebase

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Agregar 7 roles al enum `Rol`: `RESPONSABLE_TI`, `RESPONSABLE_REDES`, `RESPONSABLE_MANTENIMIENTO`, `RESPONSABLE_RECURSOS_MATERIALES`, `TECNICO_ELECTRICISTA`, `TECNICO_PLOMERO`, `TECNICO_MOVILIDAD`
- **D-02:** `TECNICO_SERVICIOS` permanece en el enum marcado como deprecated en comentario. Sin migración automática — admin reasigna manualmente.
- **D-03:** Jerarquía: ADMIN > MESA_AYUDA > RESPONSABLE_* (scope = su AreaSoporte) > TECNICO_*/GESTOR_* > EMPLEADO
- **D-04:** Nueva tabla `AreaSoporte` con `subcategorias String[]` y `rolesIncluidos String[]` almacenados como `Json` en MySQL (Claude decide implementación — elegir Json)
- **D-05:** Seed de 4 AreaSoporte: TI, REDES, MANTENIMIENTO, RECURSOS_MATERIALES con subcategorías y roles definidos
- **D-06:** `Usuario.areaSoporteId Int? @map("area_soporte_id")` — relación opcional con `AreaSoporte`
- **D-07:** RESPONSABLE_* puede reasignar tickets entre técnicos de su área (extensión de `asignarTicket`)
- **D-08:** RESPONSABLE_* puede cerrar/cancelar solicitudes de su área (extensión de `cambiarEstado`)
- **D-09:** `areaSoporteId` existe en DB ahora para que Phase 4 consuma métricas filtradas — no implementar filtrado de métricas aún
- **D-10:** `TECNICO_ELECTRICISTA` → ILUMINACION, `TECNICO_PLOMERO` → SANITARIOS, `TECNICO_MOVILIDAD` → MOVILIDAD. Seed de ProcesoDefinicion para estos 3 subtipos usa los roles específicos.
- **D-11:** En `UsuariosPage.jsx` (gestión principal) y `AdminUsuariosPage.jsx`: al seleccionar rol RESPONSABLE_*, mostrar selector de AreaSoporte. Obligatorio para RESPONSABLE_*.

### Claude's Discretion

- Implementación concreta de `subcategorias` y `rolesIncluidos` en MySQL: **usar Json** (más simple, 4 áreas fijas, sin queries complejas)
- Orden de validación en middleware RESPONSABLE_*: inferir AreaSoporte del token → leer `areaSoporteId` del usuario → comparar subcategoría del ticket
- Si `PasoDefinicion` ya tiene `TECNICO_SERVICIOS` como `rolRequerido` en pasos de MANTENIMIENTO, actualizar seed para reemplazar con subrole específico según subcategoría

### Deferred Ideas (OUT OF SCOPE)

- Room Socket.IO dedicada `responsable:{areaId}` — evaluar en Phase 4
- RESPONSABLE_* como creador de tickets en nombre de empleados
- Más subroles en RECURSOS_MATERIALES (TECNICO_ALMACEN)
- Auto-asignación de técnico según subcategoría
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ROL-01 | 7 nuevos valores en enum Rol (Prisma + Zod) | D-01: Verified current enum in schema.prisma + shared/index.ts |
| ROL-02 | Entidad AreaSoporte en DB con seed de 4 áreas | D-04/D-05: Json pattern verified; seed upsert pattern verified |
| ROL-03 | areaSoporteId en Usuario + backend CRUD | D-06: Verified current Usuario model; CRUD pattern in usuarios.controller.ts |
| ROL-04 | Middleware requireResponsableDeArea() + route guards | D-07/D-08: requireRol pattern verified in roles.middleware.ts + route files |
| ROL-05 | Panel admin: selector AreaSoporte para RESPONSABLE_* | D-11: UsuariosPage.jsx is primary; form structure verified — uses MUI Select |
</phase_requirements>

---

## Summary

Phase 3 adds 7 roles to the `Rol` enum and introduces a new `AreaSoporte` entity that maps support subcategories to role groups. The codebase is clean and well-structured — all patterns needed already exist and can be directly extended.

The Prisma enum extension requires a migration (`prisma migrate dev`) that rewrites the `MODIFY ENUM` SQL for the `usuarios` table. MySQL enum additions are additive and non-destructive when no values are removed. The `TECNICO_SERVICIOS` value is preserved in the enum, so no data migration risk.

The new `requireResponsableDeArea()` middleware follows the same `Object.assign(new Error, {status})` error pattern as existing guards but must make a DB read to resolve the user's `areaSoporteId` — the JWT payload only contains `{ id, rol, jti }`, not `areaSoporteId`. This is a confirmed design constraint.

Frontend work is concentrated in `UsuariosPage.jsx` (primary user management page at `/usuarios`) and `AdminUsuariosPage.jsx` (accessed from `/admin`). Both pages have hardcoded `ROLES` arrays that must be extended. The form pattern uses MUI `Select` components, and conditional field rendering (like the existing `esEmpleadoEstructura` switch) is the established pattern for showing the AreaSoporte selector only when a RESPONSABLE_* role is selected.

**Primary recommendation:** Implement in this order: (1) schema + migration, (2) Prisma generate, (3) shared/index.ts, (4) seed, (5) backend middleware + service guards + CRUD, (6) frontend.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Rol enum definition | Database (Prisma) | Shared (Zod mirror) | Prisma enum is source of truth; Zod mirrors for frontend type safety |
| AreaSoporte data model | Database (Prisma) | API Backend | Table + FK; API exposes via CRUD endpoint |
| areaSoporteId persistence | Database (Prisma) | API Backend | FK on Usuario; written/read through usuarios.controller.ts |
| RESPONSABLE_* area scope guard | API Backend (middleware) | — | requireResponsableDeArea() reads DB — cannot be JWT-only |
| asignarTicket RESPONSABLE_* | API Backend (service) | — | Business logic in tickets.service.ts |
| cambiarEstado RESPONSABLE_* | API Backend (service) | — | State machine guard in tickets.service.ts |
| AreaSoporte selector in form | Browser (React) | — | Conditional MUI Select in UsuariosPage.jsx / AdminUsuariosPage.jsx |
| ProcesoDefinicion subroles | Database (seed) | — | seed_procesos.ts entries for SANITARIOS, ILUMINACION, MOVILIDAD |

---

## Standard Stack

### Core (already in use — no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma ORM | current in project | Schema + migrations + client | Project-standard; all DB access through Prisma |
| `@stf/shared` (Zod) | workspace | Rol enum, Zod types | All cross-layer types live here |
| Express Router | current | Route groups | Existing pattern for all routes |
| MUI v6 (`@mui/material`) | current | Frontend form UI | Project-standard; shadcn NOT used in pages |

### No new packages required

All capabilities needed for Phase 3 are served by the existing stack. No new npm installs needed.

---

## Architecture Patterns

### System Architecture Diagram

```
Admin creates RESPONSABLE_TI user
  → POST /api/usuarios { rol: "RESPONSABLE_TI", areaSoporteId: 1 }
      → usuarios.controller.ts:crear()
          → prisma.usuario.create({ areaSoporteId: 1 })

RESPONSABLE_TI assigns ticket
  → PATCH /api/solicitudes/:id/asignar { tecnicoId }
      → requireRol("ADMIN", "RESPONSABLE_TI", ...) [route guard]
          → requireResponsableDeArea() [area scope guard — DB read]
              → tickets.service.ts:asignarTicket()
                  → validate tecnico is in responsable's area
                      → prisma.ticket.update()

RESPONSABLE_TI changes ticket state
  → PATCH /api/solicitudes/:id/estado { estado: "CANCELADO" }
      → requireRol("ADMIN", ..., "RESPONSABLE_TI", ...) [route guard]
          → requireResponsableDeArea() [area scope guard]
              → tickets.service.ts:cambiarEstado()
                  → state machine + area scope check
```

### Recommended Project Structure — Files to Modify

```
packages/
  database/prisma/
    schema.prisma           # Add AreaSoporte model + enum values + areaSoporteId field
    seed.ts                 # Add AreaSoporte seed call (after seedProcesos)
    seed_procesos.ts        # Update MANTENIMIENTO entries with subroles
  shared/src/
    index.ts                # Add 7 values to RolSchema + update LABEL_ROL + PERMISOS_DEFAULT

apps/
  api/src/
    middleware/
      roles.middleware.ts   # Add requireResponsableDeArea()
    services/
      tickets.service.ts    # Extend asignarTicket() + cambiarEstado() + listarTickets()
    controllers/
      usuarios.controller.ts # Add areaSoporteId to userSelect + create/update data
    routes/
      tickets.routes.ts     # Add new RESPONSABLE_* roles to requireRol() guards
      usuarios.routes.ts    # No change needed (already requireRol("ADMIN"))
  web/src/
    pages/
      UsuariosPage.jsx      # Extend ROLES_STAFF + add AreaSoporte selector
      AdminUsuariosPage.jsx # Extend ROLES + add AreaSoporte selector + API call
    api/
      usuarios.js           # Likely needs getAreasSoporte() helper
      admin.js              # Verify — AdminUsuariosPage uses this for user CRUD
```

### Pattern 1: Prisma Enum Addition

**What:** Adding values to an existing MySQL enum via Prisma migration.
**When to use:** Every time new Rol values are needed.

The last migration that modified the Rol enum (`20260429180311_unify_tecnico_ti_role`) shows the exact pattern:

```sql
-- Source: packages/database/prisma/migrations/20260429180311_unify_tecnico_ti_role/migration.sql
ALTER TABLE `usuarios` MODIFY `rol` ENUM(
  'ADMIN','TECNICO_TI','TECNICO_REDES','TECNICO_SERVICIOS',
  'MESA_AYUDA','GESTOR_RECURSOS_MATERIALES','EMPLEADO'
) NOT NULL;
```

Phase 3 migration will produce the same pattern with 7 additional values appended. **MySQL enum modifications are safe when only adding values**, not removing them. `TECNICO_SERVICIOS` must remain in the MODIFY statement.

### Pattern 2: AreaSoporte with Json Fields (Recommended)

**What:** Storing string arrays in MySQL using Prisma `Json` type.
**Why Json over junction tables:** 4 fixed areas, no cross-area queries, no aggregate queries on these fields in Phase 3. Phase 4 filters by `areaSoporteId` on tickets, not on AreaSoporte arrays.

```prisma
// Source: VERIFIED in schema.prisma — existing Json field pattern on Usuario.permisos
model AreaSoporte {
  id              Int      @id @default(autoincrement())
  nombre          String   @unique @db.VarChar(50)
  subcategorias   Json     // string[] — SubcategoriaTicket values
  rolesIncluidos  Json     // string[] — Rol values
  activo          Boolean  @default(true)
  createdAt       DateTime @default(now()) @map("created_at")

  usuarios        Usuario[]

  @@map("areas_soporte")
}
```

The `Usuario.permisos Json?` field is a verified precedent in the existing schema — identical pattern.

### Pattern 3: requireResponsableDeArea() Middleware

**What:** Area-scoped access guard for RESPONSABLE_* roles.
**Design decision:** Must read `areaSoporteId` from DB (not JWT) because JWT payload only contains `{ id, rol, nombre, usuario, jti }` — confirmed in auth.middleware.ts and auth.service.ts.

```typescript
// Source: VERIFIED pattern from roles.middleware.ts + permisos.middleware.ts
export const requireResponsableDeArea =
  (getTicketSubcategoria: (req: AuthRequest) => Promise<string | null>) =>
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: "No autenticado" }); return; }

    // ADMIN and MESA_AYUDA bypass — they have global scope
    const rolesGlobales: Rol[] = ["ADMIN", "MESA_AYUDA"];
    if (rolesGlobales.includes(req.user.rol)) { next(); return; }

    const rolesResponsable = [
      "RESPONSABLE_TI", "RESPONSABLE_REDES",
      "RESPONSABLE_MANTENIMIENTO", "RESPONSABLE_RECURSOS_MATERIALES",
    ];
    if (!rolesResponsable.includes(req.user.rol)) {
      res.status(403).json({ error: "Sin permisos para esta acción" }); return;
    }

    try {
      const usuario = await prisma.usuario.findUnique({
        where: { id: req.user.id },
        select: { areaSoporteId: true, activo: true },
      });
      if (!usuario?.activo || !usuario.areaSoporteId) {
        res.status(403).json({ error: "Responsable sin área asignada" }); return;
      }

      const areaSoporte = await prisma.areaSoporte.findUnique({
        where: { id: usuario.areaSoporteId },
      });
      if (!areaSoporte) {
        res.status(403).json({ error: "Área de soporte no encontrada" }); return;
      }

      const subcategoriaTicket = await getTicketSubcategoria(req);
      const subcategorias = areaSoporte.subcategorias as string[];
      if (subcategoriaTicket && !subcategorias.includes(subcategoriaTicket)) {
        res.status(403).json({ error: "Solicitud fuera del área de soporte asignada" }); return;
      }

      // Attach to req for downstream use
      (req as any).areaSoporte = areaSoporte;
      next();
    } catch (err) { next(err); }
  };
```

**Alternative approach (simpler):** Do the area scope check inside the service functions (`asignarTicket`, `cambiarEstado`) rather than as middleware. This avoids the async ticket lookup in middleware and is more consistent with how `cambiarEstado` currently checks ticket state. The planner should choose: middleware (cleaner routes) vs service-layer checks (simpler, avoids middleware complexity).

### Pattern 4: AreaSoporte Seed

**What:** Idempotent upsert for the 4 fixed areas.
**Pattern:** Upsert by `nombre` (unique key) — same pattern as `areaEdificio` seed in `seed.ts`.

```typescript
// Source: VERIFIED from packages/database/prisma/seed.ts line 258
const areas = [
  {
    nombre: "TI",
    subcategorias: ["SISTEMAS_INSTITUCIONALES", "EQUIPOS_DISPOSITIVOS", "CUENTAS_DOMINIO", "CORREO_OUTLOOK"],
    rolesIncluidos: ["RESPONSABLE_TI", "TECNICO_TI"],
  },
  {
    nombre: "REDES",
    subcategorias: ["RED_INTERNET"],
    rolesIncluidos: ["RESPONSABLE_REDES", "TECNICO_REDES"],
  },
  {
    nombre: "MANTENIMIENTO",
    subcategorias: ["SANITARIOS", "ILUMINACION", "MOVILIDAD"],
    rolesIncluidos: ["RESPONSABLE_MANTENIMIENTO", "TECNICO_ELECTRICISTA", "TECNICO_PLOMERO", "TECNICO_MOVILIDAD"],
  },
  {
    nombre: "RECURSOS_MATERIALES",
    subcategorias: ["SALA_JUNTAS", "EQUIPO_AUDIOVISUAL", "PRESTAMO_EQUIPO", "MOBILIARIO", "PAPELERIA"],
    rolesIncluidos: ["RESPONSABLE_RECURSOS_MATERIALES", "GESTOR_RECURSOS_MATERIALES"],
  },
];

for (const area of areas) {
  await prisma.areaSoporte.upsert({
    where: { nombre: area.nombre },
    update: area,
    create: { ...area, activo: true },
  });
}
```

**Order in seed.ts:** AreaSoporte seed must run AFTER `seedProcesos()` and BEFORE any test users with areaSoporteId. Current seed deletes all usuarios at start, so no FK issues.

### Pattern 5: Extending tickets.service.ts Guards

**asignarTicket — current signature (VERIFIED):**
```typescript
export const asignarTicket = async (id: number, tecnicoId: number, user: JwtPayload)
```

Current guard: only ADMIN calls this (route: `requireRol("ADMIN")`). Extension needed:
1. Route guard: add RESPONSABLE_* roles to `requireRol()`
2. Service guard: if user is RESPONSABLE_*, verify tecnico's rol is in user's AreaSoporte.rolesIncluidos AND ticket's subcategoria is in user's AreaSoporte.subcategorias
3. `CATEGORIA_ROL_MAP` must be updated to include new roles for SERVICIOS category

**cambiarEstado — current signature (VERIFIED):**
```typescript
export const cambiarEstado = async (id: number, body: { estado: string; comentario?: string }, user: JwtPayload)
```

Current guard: only `EN_PROGRESO → RESUELTO` and `ANY → CANCELADO` transitions. Extension:
- Route: add RESPONSABLE_* to `requireRol()`
- Service: if RESPONSABLE_*, verify ticket subcategoria is in their AreaSoporte

**listarTickets — must be extended for RESPONSABLE_*:**
Current role branches (VERIFIED in service lines 72-85):
- `EMPLEADO` → filter by own RFC
- `TECNICO_TI`, `TECNICO_REDES`, `TECNICO_SERVICIOS` → filter by assigned + active
- `GESTOR_RECURSOS_MATERIALES` → filter by RECURSOS_MATERIALES category

New branch needed for RESPONSABLE_*: filter tickets by subcategorías of their AreaSoporte (requires DB lookup of areaSoporteId).

### Pattern 6: Frontend — Conditional AreaSoporte Selector

**Which page is primary:** `UsuariosPage.jsx` at route `/usuarios` (accessible to ADMIN). This is where staff users are actually created. `AdminUsuariosPage.jsx` is accessible from `/admin` — both need the same change.

**Current ROLES_STAFF in UsuariosPage.jsx (VERIFIED, line 26):**
```javascript
const ROLES_STAFF = ["ADMIN", "TECNICO_TI", "TECNICO_SERVICIOS", "MESA_AYUDA", "GESTOR_RECURSOS_MATERIALES"];
```
Note: missing `TECNICO_REDES` — this is a pre-existing gap. Add all roles including 7 new ones.

**Current ROLES in AdminUsuariosPage.jsx (VERIFIED, line 16-19):**
```javascript
const ROLES = ["ADMIN", "MESA_AYUDA", "TECNICO_TI", "TECNICO_REDES", "TECNICO_SERVICIOS", "GESTOR_RECURSOS_MATERIALES"];
```

**Conditional pattern to follow (VERIFIED, line 447 UsuariosPage.jsx):**
```jsx
{form.esEmpleadoEstructura && (
  <Box>...</Box>  // Shows RFC search only when switch is on
)}
```

New selector follows same pattern:
```jsx
{RESPONSABLE_ROLES.includes(form.rol) && (
  <FormControl fullWidth required>
    <InputLabel>Área de Soporte</InputLabel>
    <Select value={form.areaSoporteId} ...>
      {areasSoporte.map(a => <MenuItem key={a.id} value={a.id}>{a.nombre}</MenuItem>)}
    </Select>
  </FormControl>
)}
```

**API call needed:** New `getAreasSoporte()` in `apps/web/src/api/` — simple GET to new endpoint `/api/areas-soporte` (or `/api/admin/areas-soporte`).

### Anti-Patterns to Avoid

- **Don't embed areaSoporteId in JWT:** JWT payload is `{ id, rol, nombre, usuario, jti }` — confirmed. Adding areaSoporteId requires token refresh on every area change. Use DB lookup in middleware instead.
- **Don't use junction tables for AreaSoporte arrays:** The 4 areas are fixed configuration, not entity relationships. Json arrays are appropriate.
- **Don't remove TECNICO_SERVICIOS from enum:** Even if deprecated, removing it from the MySQL ENUM MODIFY will fail if any row still uses it.
- **Don't upsert AreaSoporte by id:** Use `nombre` (unique) as the upsert key — same as AreaEdificio uses `id` as its upsert key.
- **Don't add areaSoporteId to the seed's deleteMany block:** The seed deletes `usuario` rows but NOT `areaSoporte` rows — treat like `areaEdificio` (upsert-only, never deleted by seed).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| String array storage in MySQL | Custom serialization / junction table | Prisma `Json` type | Precedent: `Usuario.permisos Json?` already does this |
| Role-based middleware | Custom auth layer | Extend `requireRol()` + new `requireResponsableDeArea()` | Pattern established in roles.middleware.ts |
| DB singleton in middleware | New PrismaClient instance | Import `{ prisma }` from `../config/database.js` | Singleton pattern — prevents connection pool exhaustion |
| AreaSoporte API | Separate microservice | New route group in existing Express app | Consistent with all other CRUD in the codebase |

---

## 1. Current State of Rol Enum — Exact Values

**In `packages/database/prisma/schema.prisma`** (VERIFIED):
```
enum Rol {
  ADMIN
  TECNICO_TI
  TECNICO_REDES
  TECNICO_SERVICIOS    // ← deprecated in Phase 3, stays in enum
  MESA_AYUDA
  GESTOR_RECURSOS_MATERIALES
  EMPLEADO
}
```

**In `packages/shared/src/index.ts`** (VERIFIED):
```typescript
export const RolSchema = z.enum([
  "ADMIN", "TECNICO_TI", "TECNICO_REDES", "TECNICO_SERVICIOS",
  "MESA_AYUDA", "GESTOR_RECURSOS_MATERIALES", "EMPLEADO",
]);
```

**`PERMISOS_DEFAULT` in shared/index.ts** (VERIFIED): Uses `Record<Rol, Permiso[]>` — this must be extended with all 7 new roles. The type check will fail at build time if any Rol value lacks a PERMISOS_DEFAULT entry.

**`LABEL_ROL` in shared/index.ts** (VERIFIED, line 309): Uses `Record<string, string>` (not `Record<Rol, string>`) — so adding new labels won't break TypeScript but should be done for UI consistency.

---

## 2. MySQL/Prisma Approach for AreaSoporte — RECOMMENDATION: Json

**Decision confirmed:** Use `Json` for `subcategorias` and `rolesIncluidos`.

**Why:**
- `Usuario.permisos Json?` is an identical precedent in the same schema (line 108)
- 4 fixed areas — no need for normalized queries
- No Phase 3 query needs to filter AreaSoporte records by subcategoria or rol value
- Phase 4 filters tickets by `areaSoporteId` (FK integer) — not by subcategoria array contents

**Type casting in TypeScript:** When reading `areaSoporte.subcategorias`, cast to `string[]`:
```typescript
const subcategorias = areaSoporte.subcategorias as string[];
```
Same pattern as `permisos.middleware.ts:32` which casts `usuario.permisos as Permiso[]`.

---

## 3. Middleware Pattern — requireRol and Extension

**`requireRol` current implementation** (VERIFIED, `roles.middleware.ts`):
```typescript
export const requireRol =
  (...roles: Rol[]) =>
  (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.rol)) {
      res.status(403).json({ error: "Sin permisos para esta acción" });
      return;
    }
    next();
  };
```

**Key insight:** `requireRol` is synchronous (no DB read). `requirePermiso` (permisos.middleware.ts) is async and reads DB. `requireResponsableDeArea()` must be async (needs DB lookup) — follow `requirePermiso` pattern.

**Route registration pattern** (VERIFIED, `tickets.routes.ts`):
```typescript
router.patch("/:id/asignar", requireRol("ADMIN"), ctrl.asignar);
```
Phase 3 extends to: `requireRol("ADMIN", "RESPONSABLE_TI", "RESPONSABLE_REDES", "RESPONSABLE_MANTENIMIENTO", "RESPONSABLE_RECURSOS_MATERIALES")`

Then add `requireResponsableDeArea()` as second middleware in chain.

**Simpler alternative:** Skip the middleware and put area scope check inside `tickets.service.ts` service functions. This avoids async middleware complications and is consistent with how other guards work in the service layer. The planner should choose: both approaches are valid; service-layer is less code.

---

## 4. tickets.service.ts — Exact Signatures and Existing Guards

**`asignarTicket` (VERIFIED, line 329):**
```typescript
export const asignarTicket = async (id: number, tecnicoId: number, user: JwtPayload) => {
```
Existing guards:
1. Ticket not found → 404
2. Ticket has pasos → 400 (D-12 from Phase 2)
3. Tecnico not found → 404
4. Tecnico rol not in `CATEGORIA_ROL_MAP[ticket.categoria]` → 400

**`CATEGORIA_ROL_MAP` (VERIFIED, line 323):**
```typescript
const CATEGORIA_ROL_MAP: Record<string, string[]> = {
  TECNOLOGIAS: ["TECNICO_TI", "TECNICO_REDES"],
  SERVICIOS: ["TECNICO_SERVICIOS"],
  RECURSOS_MATERIALES: ["GESTOR_RECURSOS_MATERIALES"],
};
```

**Phase 3 must update this map:**
- `SERVICIOS` → `["TECNICO_ELECTRICISTA", "TECNICO_PLOMERO", "TECNICO_MOVILIDAD", "TECNICO_SERVICIOS"]` (TECNICO_SERVICIOS kept for compatibility with existing assigned tickets)
- New RESPONSABLE_* roles should NOT appear in this map — they assign, they don't do the work.

**`cambiarEstado` (VERIFIED, line 396):**
```typescript
export const cambiarEstado = async (id: number, body: { estado: string; comentario?: string }, user: JwtPayload) => {
```
Existing guards:
1. Ticket not found → 404
2. Transition not in `TRANSICIONES[ticket.estado]` → 400
3. RESUELTO with pending pasos → 400 (D-10 from Phase 2)

No existing rol-based guard inside `cambiarEstado` itself — the route-level `requireRol()` is the only gate. Phase 3 needs to add a scope check inside the service for RESPONSABLE_*.

**`listarTickets` role branches (VERIFIED, lines 72-85):**
```typescript
if (user.rol === "EMPLEADO") { where.empleadoRfc = user.rfc; }
else if (user.rol === "TECNICO_TI" || user.rol === "TECNICO_REDES" || user.rol === "TECNICO_SERVICIOS") {
  where.tecnicoId = user.id;
  where.estado = { notIn: ["RESUELTO", "CANCELADO"] };
}
else if (user.rol === "GESTOR_RECURSOS_MATERIALES") { where.categoria = "RECURSOS_MATERIALES"; }
// ADMIN, MESA_AYUDA → no filter (see all)
```

Phase 3 adds: `else if (RESPONSABLE_ROLES.includes(user.rol))` — must join to AreaSoporte to get subcategorias, then filter `where.subcategoria = { in: subcategorias }`.

**Warning:** The tecnico list branches will need new roles: `TECNICO_ELECTRICISTA`, `TECNICO_PLOMERO`, `TECNICO_MOVILIDAD` should see their assigned tickets. Add them to the TECNICO_* branch.

---

## 5. usuarios.controller.ts — CRUD Pattern and areaSoporteId Addition

**`userSelect` constant (VERIFIED, lines 8-22):**
```typescript
const userSelect = {
  id: true, nombre: true, apellidos: true, usuario: true,
  email: true, telefono: true, rol: true, activo: true,
  permisos: true, esEmpleadoEstructura: true, empleadoId: true, rfc: true, createdAt: true,
};
```

Must add: `areaSoporteId: true` and optionally `areaSoporte: { select: { nombre: true } }` for display.

**`crear` handler (VERIFIED, lines 33-58):**
Destructures `req.body` with explicit typing. Adding `areaSoporteId?: number` to the destructure and including it in `prisma.usuario.create({ data: { ... areaSoporteId: areaSoporteId ?? null } })`.

Validation rule to add: if `rest.rol` starts with `"RESPONSABLE_"`, require `areaSoporteId` to be non-null.

**`actualizar` handler (VERIFIED, lines 74-97):**
Uses spread pattern: `const data: Record<string, unknown> = { ...rest }`. `areaSoporteId` flows through automatically if included in `req.body`, but the handler should also handle clearing it (`areaSoporteId: null`) when rol changes away from RESPONSABLE_*.

---

## 6. Seed Pattern — Exact Upsert and Order of Operations

**AreaEdificio upsert (VERIFIED, seed.ts lines 257-264):**
```typescript
for (const area of areas) {
  await prisma.areaEdificio.upsert({
    where: { id: area.id },
    update: area,
    create: area,
  });
}
```

**AreaSoporte upsert** follows same pattern with `where: { nombre: area.nombre }`.

**Current seed.ts call order (VERIFIED):**
1. `deleteMany` for transactional data (notificaciones, comentarios, historialTicket, pasoTicket, ticket, usuario)
2. Upsert `areaEdificio` (never deleted)
3. Create admin `usuario`
4. Call `seedProcesos(prisma)` — last item

**Phase 3 insertion point:** Add AreaSoporte seed call BEFORE step 3 (creating admin), since Usuario FK to AreaSoporte must exist. Or place it after step 2 (areaEdificio upserts). AreaSoporte is NOT in the deleteMany block.

**seed_procesos.ts MANTENIMIENTO entries — confirmed NOT using TECNICO_SERVICIOS:** The current `PROCESO_SEED_MAP` (VERIFIED) has no MANTENIMIENTO, SANITARIOS, ILUMINACION, or MOVILIDAD entries. These subcategorías have no ProcesoDefinicion seeds yet. Phase 3 must ADD these entries (not update existing ones). Three new seed entries:

```typescript
SANITARIOS: { tipoFlujo: "DIRECTO", pasos: [{ rolRequerido: "TECNICO_PLOMERO", ... }] },
ILUMINACION: { tipoFlujo: "DIRECTO", pasos: [{ rolRequerido: "TECNICO_ELECTRICISTA", ... }] },
MOVILIDAD:   { tipoFlujo: "DIRECTO", pasos: [{ rolRequerido: "TECNICO_MOVILIDAD", ... }] },
```

---

## 7. Frontend — User Creation/Editing Pages

**Two pages exist (VERIFIED):**

| Page | Route | Accessible by | API module | Primary use |
|------|-------|--------------|------------|-------------|
| `UsuariosPage.jsx` | `/usuarios` | ADMIN | `../api/usuarios.js` | Full user management + SIRH sync |
| `AdminUsuariosPage.jsx` | `/admin` (sub-view) | ADMIN | `../api/admin.js` | Admin panel sub-view with granular permissions |

**Both pages need the AreaSoporte selector.** They use different API modules (`usuarios.js` vs `admin.js`).

**UsuariosPage.jsx form structure (VERIFIED):**
- `emptyForm` object with all fields (line 36-39)
- `set(k, v)` helper updates form state (line 209)
- Dialog with MUI `Select` for rol (line 549-554)
- Conditional sections using `{condition && <Box>...</Box>}` pattern (line 447)

**AdminUsuariosPage.jsx form structure (VERIFIED):**
- `EMPTY_FORM` at top (line 21-24)
- `handleRolChange()` resets permisos on rol change (line 69-72) — **Phase 3 must also reset areaSoporteId here when rol changes away from RESPONSABLE_***
- `form.rol` drives conditional rendering of permisos section

**emptyForm/EMPTY_FORM must add:** `areaSoporteId: null` or `areaSoporteId: ""`

**New API call needed:** Both pages need `getAreasSoporte()`. Currently no such endpoint exists. New endpoint: `GET /api/areas-soporte` returning `{ data: AreaSoporte[] }`.

---

## 8. Socket.IO Rooms — RESPONSABLE_* in Phase 3

**Current rooms (VERIFIED from ARCHITECTURE.md):**

| Room | Who joins | Events received |
|------|-----------|----------------|
| `admins` | ADMIN, MESA_AYUDA | ticket:nuevo, ticket:estado_cambiado, ticket:paso_listo |
| `user:{userId}` | all staff | ticket:asignado, ticket:paso_asignado |
| `emp:{rfc}` | empleados | ticket:asignado_empleado, ticket:estado_cambiado |

**Phase 3 decision (confirmed deferred):** Room `responsable:{areaId}` is deferred to Phase 4. In Phase 3, RESPONSABLE_* users should join the `admins` room to receive `ticket:nuevo` and `ticket:paso_listo` events. This is handled in `apps/api/src/sockets/tickets.socket.ts` where `join:admin` is emitted.

**Frontend `notificaciones.js` store:** Currently emits `join:admin` for ADMIN and MESA_AYUDA roles. Must extend to also emit `join:admin` for RESPONSABLE_* roles in Phase 3.

**No new Socket.IO events needed in Phase 3.** The existing events cover all cases.

---

## 9. ProcesoDefinicion Seeds — MANTENIMIENTO Subroles

**Confirmed: SANITARIOS, ILUMINACION, MOVILIDAD have NO existing ProcesoDefinicion entries** (VERIFIED in seed_procesos.ts — the file does not contain any of these keys).

**TECNICO_SERVICIOS usage in existing seed (VERIFIED):** `TECNICO_SERVICIOS` does NOT appear anywhere in `seed_procesos.ts`. All existing entries use `TECNICO_TI` or `TECNICO_REDES`. No replacement needed.

**Three new entries to add to `PROCESO_SEED_MAP`:**
```
"SANITARIOS" → rolRequerido: "TECNICO_PLOMERO"
"ILUMINACION" → rolRequerido: "TECNICO_ELECTRICISTA"
"MOVILIDAD" → rolRequerido: "TECNICO_MOVILIDAD"
```

Note: These are subcategorías under the `SERVICIOS` categoria. The `crearTicket` service currently only calls `seedProcesos` for `categoriaVal === "TECNOLOGIAS"` (line 247 tickets.service.ts). **This is a critical gap:** MANTENIMIENTO tickets (SERVICIOS category) will never get pasos generated unless the condition is extended to include SERVICIOS category.

---

## 10. Migration Strategy

**Established pattern (VERIFIED from 21 migration files):** `prisma migrate dev` — generates SQL migration files in `packages/database/prisma/migrations/`. All prior phases used this method.

**Command (from CLAUDE.md):**
```bash
# From packages/database/
npm run db:migrate   # = prisma migrate dev
npm run db:generate  # = prisma generate
```

**Phase 3 requires 2 schema changes:**
1. Enum extension — 7 new Rol values → `ALTER TABLE usuarios MODIFY rol ENUM(...)`
2. New AreaSoporte table + FK on Usuario → `CREATE TABLE areas_soporte` + `ALTER TABLE usuarios ADD COLUMN area_soporte_id`

Both changes can be in one migration. Prisma will generate the migration automatically from schema diff.

**Migration risk:** MySQL `MODIFY ENUM` requires ALL existing values to be listed in order. Prisma handles this correctly but the migration must be reviewed before applying — confirm that `TECNICO_SERVICIOS` is preserved in the generated SQL.

**No `db:push` — use `migrate dev`** for consistent migration history.

---

## Common Pitfalls

### Pitfall 1: PERMISOS_DEFAULT TypeScript Error
**What goes wrong:** `PERMISOS_DEFAULT` is typed `Record<Rol, Permiso[]>` (line 530 shared/index.ts). Adding 7 new values to the `Rol` enum without adding entries to `PERMISOS_DEFAULT` causes a TypeScript build error.
**Why it happens:** TypeScript enforces exhaustive coverage of union type keys.
**How to avoid:** Add all 7 new roles to `PERMISOS_DEFAULT` in the same commit as the enum extension. Define which permissions each role gets by default.
**Warning signs:** `npm run build` fails with "Type '...' is not assignable to type 'Record<Rol, Permiso[]>'"

### Pitfall 2: crearTicket Only Generates Pasos for TECNOLOGIAS
**What goes wrong:** `tickets.service.ts` line 247: `if (categoriaVal === "TECNOLOGIAS")` — SERVICIOS tickets (SANITARIOS, ILUMINACION, MOVILIDAD) will never have pasos generated even after adding ProcesoDefinicion seeds.
**Why it happens:** The condition was written when only TECNOLOGIAS had multi-step flows.
**How to avoid:** Extend condition to `if (["TECNOLOGIAS", "SERVICIOS"].includes(categoriaVal))` when adding MANTENIMIENTO proceso seeds.
**Warning signs:** Creating a SANITARIOS ticket → no PasoTicket rows created even though ProcesoDefinicion exists.

### Pitfall 3: UsuariosPage.jsx Sends areaSoporteId When Not RESPONSABLE_*
**What goes wrong:** If `emptyForm` includes `areaSoporteId` and it's populated, the backend receives it even for non-RESPONSABLE roles, potentially linking a TECNICO_TI to an AreaSoporte.
**Why it happens:** The form sends the full payload without filtering.
**How to avoid:** In `handleGuardar()`, clear `areaSoporteId` from payload when `form.rol` is not in `RESPONSABLE_ROLES`. Mirror the existing pattern for `empleadoId`/`rfc` (line 181-183).

### Pitfall 4: Migration Drops TECNICO_SERVICIOS from Enum
**What goes wrong:** If schema.prisma comment about TECNICO_SERVICIOS is misread and the value is accidentally removed, the migration will fail on rows still using it.
**Why it happens:** MySQL MODIFY ENUM fails if existing rows contain removed values.
**How to avoid:** Keep `TECNICO_SERVICIOS` in the enum and in the PERMISOS_DEFAULT. Never remove it from schema.prisma.

### Pitfall 5: areaSoporteId FK Created Before AreaSoporte Table
**What goes wrong:** If migration order tries to add `areaSoporteId` column to `usuarios` before the `areas_soporte` table exists, the FK constraint fails.
**Why it happens:** Incorrect migration ordering.
**How to avoid:** Prisma handles this correctly when both changes are in one migration. If split into two migrations, create AreaSoporte table first.

### Pitfall 6: RESPONSABLE_* in listarTickets Not Filtered
**What goes wrong:** If RESPONSABLE_* falls through to the "no filter" case (same as ADMIN/MESA_AYUDA), they see all tickets system-wide.
**Why it happens:** The if/else chain doesn't include RESPONSABLE_* branches.
**How to avoid:** Add explicit branch for RESPONSABLE_* before the implicit "see all" fallthrough.

### Pitfall 7: AdminUsuariosPage Uses Different API Module
**What goes wrong:** `AdminUsuariosPage.jsx` imports from `../api/admin.js` while `UsuariosPage.jsx` imports from `../api/usuarios.js`. Adding `getAreasSoporte()` to only one module breaks the other page.
**Why it happens:** Two pages, two API modules.
**How to avoid:** Add `getAreasSoporte()` to a shared location or both modules. Verify which endpoint each page calls for user CRUD to avoid duplicate endpoint issues.

---

## Code Examples

### Migration Output Expected

```sql
-- Generated by: prisma migrate dev
ALTER TABLE `usuarios` MODIFY `rol` ENUM(
  'ADMIN','TECNICO_TI','TECNICO_REDES','TECNICO_SERVICIOS','MESA_AYUDA',
  'GESTOR_RECURSOS_MATERIALES','EMPLEADO',
  'RESPONSABLE_TI','RESPONSABLE_REDES','RESPONSABLE_MANTENIMIENTO',
  'RESPONSABLE_RECURSOS_MATERIALES','TECNICO_ELECTRICISTA',
  'TECNICO_PLOMERO','TECNICO_MOVILIDAD'
) NOT NULL;

CREATE TABLE `areas_soporte` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(50) NOT NULL,
  `subcategorias` JSON NOT NULL,
  `rolesIncluidos` JSON NOT NULL,
  `activo` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `areas_soporte_nombre_key`(`nombre`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

ALTER TABLE `usuarios` ADD COLUMN `area_soporte_id` INTEGER NULL;
ALTER TABLE `usuarios` ADD CONSTRAINT `usuarios_area_soporte_id_fkey`
  FOREIGN KEY (`area_soporte_id`) REFERENCES `areas_soporte`(`id`);
```

### JwtPayload Type — Confirmed Fields

```typescript
// Source: VERIFIED from auth.middleware.ts + auth.service.ts behavior
// JWT payload contains: { id, rol, nombre, usuario, jti } for staff
// JWT payload contains: { id, rol, rfc, nombre, jti } for empleados
// areaSoporteId is NOT in JWT — must read from DB in middleware
```

### PERMISOS_DEFAULT Extension Required

```typescript
// Source: VERIFIED from shared/index.ts line 530
// Must add for each of 7 new roles:
RESPONSABLE_TI: ["solicitudes.ver_todas", "solicitudes.asignar", "pasos.asignar", "metricas.ver"],
RESPONSABLE_REDES: ["solicitudes.ver_todas", "solicitudes.asignar", "pasos.asignar", "metricas.ver"],
RESPONSABLE_MANTENIMIENTO: ["solicitudes.ver_todas", "solicitudes.asignar", "pasos.asignar", "metricas.ver"],
RESPONSABLE_RECURSOS_MATERIALES: ["solicitudes.ver_todas", "solicitudes.asignar", "pasos.asignar", "metricas.ver"],
TECNICO_ELECTRICISTA: ["solicitudes.ver_todas"],
TECNICO_PLOMERO: ["solicitudes.ver_todas"],
TECNICO_MOVILIDAD: ["solicitudes.ver_todas"],
// Note: TECNICO_SERVICIOS already exists at line 541, keep as-is
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TECNICO_SERVICIOS covers all SERVICIOS | Specialized TECNICO_ELECTRICISTA/PLOMERO/MOVILIDAD | Phase 3 | Subcategory-specific routing; TECNICO_SERVICIOS deprecated |
| No area-scoped managers | RESPONSABLE_* per area | Phase 3 | Decentralized ticket management within areas |
| PROCESO_MAP hardcoded (SERVICIOS: no pasos) | ProcesoDefinicion DB (SERVICIOS: new seeds) | Phase 3 | MANTENIMIENTO tickets get workflow steps |

---

## Runtime State Inventory

> Phase 3 is not a rename/refactor phase — this section covers operational state that affects planning.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing users with `TECNICO_SERVICIOS` rol in DB | No migration — admin reasigna manualmente (D-02) |
| Stored data | Existing tickets assigned to TECNICO_SERVICIOS users | No change — historical tickets remain valid |
| Live service config | None | — |
| OS-registered state | None | — |
| Secrets/env vars | None | — |
| Build artifacts | Prisma client must be regenerated after schema change | `npm run db:generate` required after migration |

---

## Open Questions (RESOLVED)

1. **areaSoporteId endpoint location**
   - What we know: `UsuariosPage.jsx` uses `../api/usuarios.js`, `AdminUsuariosPage.jsx` uses `../api/admin.js`
   - What's unclear: Should `GET /api/areas-soporte` be a new route group or added to `/api/admin`?
   - Recommendation: Add `GET /api/admin/areas-soporte` (behind existing `requireRol("ADMIN")`) to avoid a new router file. Or add to `/api/catalogos` since catalogo routes are already public-ish.
   - **RESOLVED:** Endpoint registered as `GET /api/admin/areas-soporte` in `admin.routes.ts` (Plan 03, Task 3). Protected by the existing `requireRol("ADMIN")` guard at router level. Both `catalogos.js` and `admin.js` frontend modules call this same URL.

2. **RESPONSABLE_* can close/cancel — which CANCELADO transitions apply?**
   - What we know: `cambiarEstado` uses `TRANSICIONES` map: `ABIERTO → CANCELADO`, `ASIGNADO → CANCELADO`, `EN_PROGRESO → CANCELADO`
   - What's unclear: D-08 says RESPONSABLE_* can "cerrar/cancelar" — does this include all states or only specific ones?
   - Recommendation: Allow RESPONSABLE_* to CANCELAR from any non-terminal state (same as ADMIN). Require area scope check. For RESUELTO, require all pasos completed (existing guard).
   - **RESOLVED:** All non-terminal CANCELADO transitions are permitted for RESPONSABLE_* within their area. The service-layer guard in `cambiarEstado` checks `areaSoporte.subcategorias.includes(ticket.subcategoria)` before allowing the transition; terminal states (RESUELTO, CANCELADO) are blocked by the existing `TRANSICIONES` map in `tickets.service.ts`.

3. **notificaciones.js frontend — join:admin for RESPONSABLE_*?**
   - What we know: `join:admin` room receives `ticket:nuevo` and `ticket:paso_listo`. Deferred room `responsable:{areaId}` is Phase 4.
   - Recommendation: In Phase 3, have RESPONSABLE_* join `admins` room so they receive ticket:nuevo. This means they see ALL new tickets, not just their area's — acceptable tradeoff until Phase 4 implements filtered rooms.
   - **RESOLVED:** RESPONSABLE_* joins the `admins` room in Phase 3 via extension of `apps/web/src/store/notificaciones.js` (the `socket.on('connect')` handler, line 62). The `user.rol === 'ADMIN' || user.rol === 'MESA_AYUDA'` condition is extended to include all four RESPONSABLE_* values. Dedicated `responsable:{areaId}` room deferred to Phase 4.

---

## Environment Availability

Phase 3 is code/config changes with existing stack. No new external dependencies.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| MySQL (XAMPP) | Prisma migrations | Must be running | Project requires XAMPP | None — required |
| Node.js | Build + seed | Available | Project running | — |
| Prisma CLI | db:migrate, db:generate | Available (in packages/database) | Current | — |

---

## Security Domain

`security_enforcement: true` in config.json.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth changes in Phase 3 |
| V3 Session Management | No | Session management unchanged |
| V4 Access Control | YES | requireResponsableDeArea() — area-scoped authorization |
| V5 Input Validation | YES | Zod validation for areaSoporteId in create/update |
| V6 Cryptography | No | No crypto changes |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| RESPONSABLE_TI accessing RESPONSABLE_REDES tickets | Elevation of Privilege | requireResponsableDeArea() checks subcategoria against areaSoporte.subcategorias |
| Forged areaSoporteId in JWT | Tampering | areaSoporteId NOT in JWT — always read from DB in middleware |
| RESPONSABLE_* assigned to wrong area by admin | Misconfiguration | Backend validates areaSoporteId exists in AreaSoporte table |
| TECNICO_SERVICIOS deprecated but used as RESPONSABLE | Broken Access Control | RESPONSABLE_* middleware only activates for explicit RESPONSABLE_* roles — TECNICO_SERVICIOS is not in the list |
| Missing CORS / auth on /api/areas-soporte | Information Disclosure | Use existing `authMiddleware` + `requireRol("ADMIN")` on new endpoint |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `apps/web/src/api/usuarios.js` and `admin.js` do not currently have a `getAreasSoporte()` function | Frontend section | Low — easy to verify; just add it |
| A2 | `apps/api/src/sockets/tickets.socket.ts` handles `join:admin` room and frontend `notificaciones.js` emits it for ADMIN/MESA_AYUDA | Socket.IO section | Medium — if structure differs, frontend needs different change |
| A3 | RESPONSABLE_* permissions listed in PERMISOS_DEFAULT (solicitades.asignar, etc.) are appropriate for their role | PERMISOS_DEFAULT section | Medium — user may want different defaults; easy to adjust |

---

## Sources

### Primary (HIGH confidence — directly verified from codebase)

- `packages/database/prisma/schema.prisma` — Rol enum (7 values), Usuario model, AreaEdificio model, ProcesoDefinicion model
- `packages/shared/src/index.ts` — RolSchema, PERMISOS_DEFAULT, SUBCATEGORIAS_POR_CATEGORIA
- `apps/api/src/middleware/roles.middleware.ts` — requireRol() implementation
- `apps/api/src/middleware/permisos.middleware.ts` — async middleware pattern with DB read
- `apps/api/src/services/tickets.service.ts` — asignarTicket, cambiarEstado, listarTickets exact code
- `apps/api/src/controllers/usuarios.controller.ts` — userSelect, crear, actualizar patterns
- `packages/database/prisma/seed.ts` — seed structure, upsert pattern, deleteMany order
- `packages/database/prisma/seed_procesos.ts` — ProcesoSeedMap, confirmed NO MANTENIMIENTO entries
- `apps/web/src/pages/UsuariosPage.jsx` — ROLES_STAFF, form structure, conditional rendering
- `apps/web/src/pages/AdminUsuariosPage.jsx` — ROLES, form structure, permisos section
- `apps/api/src/routes/tickets.routes.ts` — route guards, requireRol placement
- `packages/database/prisma/migrations/20260429180311_unify_tecnico_ti_role/migration.sql` — MODIFY ENUM pattern
- `.planning/codebase/ARCHITECTURE.md` — Socket.IO rooms, JWT payload, frontend state management

### Secondary (MEDIUM confidence — from planning documents)

- `.planning/phases/03-roles-y-areas-de-soporte/03-CONTEXT.md` — decisions D-01 through D-11

---

## Metadata

**Confidence breakdown:**
- Current enum state: HIGH — read directly from schema.prisma and shared/index.ts
- AreaSoporte implementation: HIGH — Json precedent verified in Usuario.permisos
- Middleware pattern: HIGH — verified from roles.middleware.ts + permisos.middleware.ts
- Seed pattern: HIGH — verified from seed.ts + seed_procesos.ts
- Frontend form structure: HIGH — read both page files completely
- ProcesoDefinicion MANTENIMIENTO gap: HIGH — confirmed NO entries exist

**Research date:** 2026-05-13
**Valid until:** 2026-06-13 (stable codebase, 30-day window)
