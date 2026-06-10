---
phase: 03-roles-y-areas-de-soporte
reviewed: 2026-05-25T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - apps/api/src/controllers/usuarios.controller.ts
  - apps/web/src/pages/AdminUsuariosPage.jsx
  - apps/web/src/pages/UsuariosPage.jsx
findings:
  critical: 4
  warning: 6
  info: 4
  total: 14
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-05-25T00:00:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Three files were reviewed: the backend `usuarios.controller.ts` and two frontend pages (`AdminUsuariosPage.jsx`, `UsuariosPage.jsx`).

The controller has no backend input validation beyond required-field presence — no password strength enforcement, no format validation for email/RFC/phone, and no duplicate-check error handling, meaning Prisma unique-constraint errors surface as raw 500s. More critically, the `actualizar` handler accepts an unrestricted spread of `req.body` directly into the Prisma `data` object, which is a **mass-assignment vulnerability**. The frontend pages have two independent implementations of the same user-management surface (`AdminUsuariosPage` targets `/api/admin/usuarios`, `UsuariosPage` targets `/api/usuarios`) with divergent behavior (hard delete vs. soft delete) and divergent `permisos` logic; this is a systemic duplication problem.

The `UsuariosPage` exposes a hard **Delete** button that calls `deleteUsuario` — which hits `DELETE /api/usuarios/:id` — directly violating the project's soft-delete rule. The `handleSyncNow` interval in `UsuariosPage` is never cleared on component unmount, causing a memory leak and potential state-mutation on an unmounted component. A duplicate icon import (`WhatsAppIcon` / `WhatsAppIcon2`) is also present.

---

## Critical Issues

### CR-01: Mass-assignment vulnerability in `actualizar` — arbitrary fields accepted from request body

**File:** `apps/api/src/controllers/usuarios.controller.ts:133`
**Issue:** `const data: Record<string, unknown> = { ...rest }` spreads every property from `req.body` that was not destructured (i.e., every field that is not `password`, `usuario`, `esEmpleadoEstructura`, `empleadoId`, `rfc`, or `permisos`) directly into the Prisma `update` payload without any allowlist. An authenticated ADMIN-level caller can send arbitrary Prisma model fields such as `createdAt`, `id`, `rol` (bypassing any role-constraint logic), `activo` set to any value, or any future sensitive fields added to the model.

The `crear` handler is safer because `...rest` is spread into typed Prisma `data` and TypeScript/Prisma would reject unknown fields at compile-time, but the `actualizar` handler uses `Record<string, unknown>` and Prisma's `update` with that type accepts unknown keys silently.

**Fix:**
```typescript
// Define an explicit allowlist of updatable fields
const ALLOWED_UPDATE_FIELDS = [
  "nombre", "apellidos", "email", "telefono", "rol", "activo",
] as const;

export const actualizar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body;
    const { password, usuario, esEmpleadoEstructura, empleadoId, rfc, permisos } = body;

    // Only pick allowed fields from body instead of spreading rest
    const data: Record<string, unknown> = {};
    for (const field of ALLOWED_UPDATE_FIELDS) {
      if (body[field] !== undefined) data[field] = body[field];
    }

    // ... rest of validations and additions
  }
};
```

---

### CR-02: `UsuariosPage` performs hard delete in violation of project soft-delete rule

**File:** `apps/web/src/pages/UsuariosPage.jsx:225-232`
**Issue:** `handleEliminar` calls `deleteUsuario(id)` which maps to `DELETE /api/usuarios/:id`. The `desactivar` handler on that route sets `activo: false` (soft delete), but only because `usuarios.routes.ts` also maps DELETE to `desactivar`. However, `UsuariosPage` also imports `deleteUsuario` from `../api/usuarios.js` (line 23), while `AdminUsuariosPage` calls `desactivarUsuario` which also reaches the same soft-delete endpoint. The `deleteUsuario` call in `UsuariosPage` bypasses the confirmation dialog labeling ("Desactivar") that would communicate intent to the user — the button shows a trash/delete icon with tooltip "Eliminar", which implies permanent deletion and misleads users and future maintainers. If the route is ever changed to a real hard-delete (to match the UI's stated intent), data would be permanently lost.

Beyond the UX mismatch, the project rule states "Soft delete en tickets: `activo = false` en lugar de borrado físico." The same convention must apply to users. `UsuariosPage` should use `desactivarUsuario` (or at minimum the `updateUsuario` patch with `{ activo: false }`) and change the UI to match.

**Fix:**
```jsx
// In UsuariosPage.jsx, replace handleEliminar:
const handleDesactivar = async (id) => {
  if (!window.confirm("¿Desactivar este usuario?")) return;
  try {
    await updateUsuario(id, { activo: false });
    load();
  } catch (err) {
    alert(err.response?.data?.error ?? "Error al desactivar");
  }
};
// Change button icon from DeleteIcon to PersonOffIcon, tooltip from "Eliminar" to "Desactivar"
```

---

### CR-03: Interval in `handleSyncNow` is never cleared on component unmount — state mutation on unmounted component

**File:** `apps/web/src/pages/UsuariosPage.jsx:79-89`
**Issue:** `setInterval` is created inside `handleSyncNow` and stored only in a local variable `interval`. If the component unmounts while the interval is running (e.g., user navigates away), the interval continues executing, calling `setSyncData`, `setSyncLoading`, and `setSyncMsg` on an unmounted component. In React 18 strict mode this will silently fail, but in earlier versions (or if the project's error boundaries catch it) it can produce the "Can't perform a React state update on an unmounted component" warning and potentially mask real errors. Additionally, if the API call inside the interval rejects (the `.catch(() => null)` swallows errors silently), `clearInterval` is never reached on that tick, but the interval still keeps retrying.

**Fix:**
```jsx
// Use a ref to hold the interval so it can be cleared on unmount
const syncIntervalRef = useRef(null);

useEffect(() => {
  return () => {
    if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
  };
}, []);

const handleSyncNow = async () => {
  // ...
  syncIntervalRef.current = setInterval(async () => {
    const res = await getSirhSyncStatus().catch(() => null);
    if (res?.data) {
      setSyncData(res.data);
      if (!res.data.enProgreso) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
        setSyncLoading(false);
        setSyncMsg("¡Sincronización completada!");
      }
    }
  }, 5000);
};
```

---

### CR-04: `load()` in `UsuariosPage` silently swallows errors — failed loads show stale or empty data with no feedback

**File:** `apps/web/src/pages/UsuariosPage.jsx:96-104`
**Issue:** The `load` function has a `try/finally` but no `catch`. If `getUsuarios()` throws (network error, 401, 500), the error is swallowed entirely — `setLoading(false)` is called, the table renders empty, and no error state is set. The user sees an empty table with no explanation. Compare with `cargar()` in `AdminUsuariosPage` (line 40-51) which correctly sets `setError(...)` in its catch block. The asymmetry also demonstrates that the two pages are not maintained in sync.

**Fix:**
```jsx
const load = async () => {
  setLoading(true);
  setError("");
  try {
    const res = await getUsuarios();
    setUsuarios(res.data ?? []);
  } catch {
    setError("Error al cargar usuarios");
  } finally {
    setLoading(false);
  }
};
```

---

## Warnings

### WR-01: No password strength enforcement in backend `crear` — any non-empty string accepted

**File:** `apps/api/src/controllers/usuarios.controller.ts:73`
**Issue:** The only password validation is `!password?.trim()` (non-empty check). A password of `" "` (single space) passes the trim check only because `trim()` is called on the condition but `bcrypt.hash(password, 10)` receives the original untrimmed value. More importantly, a password of `"a"` is accepted and hashed. For a government system (SIAST context), minimum password length should be enforced in the backend, not only optionally in the frontend.

**Fix:**
```typescript
if (!password || password.trim().length < 8) {
  camposFaltantes.push("password"); // or return specific error
}
```

---

### WR-02: `actualizar` handler: changing rol without clearing `permisos` leaves stale extra permissions

**File:** `apps/api/src/controllers/usuarios.controller.ts:144-146`
**Issue:** When `rest.rol` changes, `areaSoporteId` is recomputed (line 145), but `permisos` is only updated if explicitly passed by the client (line 136). This means a user whose role is downgraded (e.g., from `ADMIN` to `TECNICO_TI`) retains their previously stored extra `permisos` array from the prior role. If the application checks `permisos` to grant elevated access, the stale permissions remain active until explicitly cleared by an admin. The frontend `handleRolChange` (AdminUsuariosPage line 78) resets `permisos: []` on role change in the UI, but if the API is called directly or through `UsuariosPage` (which does not reset permisos on rol change), this is bypassed.

**Fix:**
```typescript
if (rest.rol) {
  data.areaSoporteId = await resolveAreaId(rest.rol as string);
  // Clear extra permisos when role changes unless caller explicitly provides new ones
  if (permisos === undefined) {
    data.permisos = [];
  }
}
```

---

### WR-03: `parseId` does not validate NaN — non-numeric route params silently produce NaN

**File:** `apps/api/src/controllers/usuarios.controller.ts:28-29`
**Issue:** `parseInt(param, 10)` returns `NaN` if `param` is not numeric (e.g., `GET /api/usuarios/abc`). `NaN` is then passed to Prisma's `where: { id: NaN }`. Prisma with MySQL will coerce this to `0` or throw a type error depending on the adapter version, neither of which produces a clean 400 response. Routes with path params should validate the ID before querying.

**Fix:**
```typescript
const parseId = (param: string | string[]): number => {
  const raw = Array.isArray(param) ? param[0] : param;
  const id = parseInt(raw, 10);
  if (isNaN(id) || id <= 0) throw Object.assign(new Error("ID inválido"), { status: 400 });
  return id;
};
```

---

### WR-04: `desactivar` handler has no 404 guard — attempting to deactivate a non-existent user produces a 500

**File:** `apps/api/src/controllers/usuarios.controller.ts:159-169`
**Issue:** `prisma.usuario.update({ where: { id: ... } })` throws `PrismaClientKnownRequestError` with code `P2025` ("Record to update not found") if the user does not exist. This propagates to `next(err)` as an unhandled Prisma error and likely results in a 500 response. The `actualizar` handler has the same problem. The `obtener` handler correctly handles the 404 case.

**Fix:**
```typescript
export const desactivar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req.params.id);
    const exists = await prisma.usuario.findUnique({ where: { id }, select: { id: true } });
    if (!exists) { res.status(404).json({ error: "Usuario no encontrado" }); return; }
    await prisma.usuario.update({ where: { id }, data: { activo: false } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};
```

---

### WR-05: `isDirty` check in `UsuariosPage` produces false positives during edit — fires unsaved-changes dialog on cancel without any actual edits

**File:** `apps/web/src/pages/UsuariosPage.jsx:238-243`
**Issue:** `isDirty` is `true` whenever `dialog` is open AND any of `nombre`, `apellidos`, `usuario`, or `password` have non-empty trimmed values. When editing an existing user (`openEditar`), the form is pre-populated with the user's current name and username. Therefore `isDirty` is immediately `true` upon opening the edit dialog, before the user changes anything. Clicking "Cancelar" will trigger the "unsaved changes" confirmation dialog even if the user made zero edits.

**Fix:** Track a `formSnapshot` captured at dialog-open time and compare the current form against it:
```jsx
const [formSnapshot, setFormSnapshot] = useState(null);

const openEditar = (u) => {
  const initial = { nombre: u.nombre, apellidos: u.apellidos, usuario: u.usuario, password: "" };
  setFormSnapshot(initial);
  // ...
};

const isDirty = Boolean(dialog) && formSnapshot !== null && (
  form.nombre !== formSnapshot.nombre ||
  form.apellidos !== formSnapshot.apellidos ||
  form.usuario !== formSnapshot.usuario ||
  form.password.trim().length > 0
);
```

---

### WR-06: Two pages manage users against two different API paths with divergent behavior — `UsuariosPage` has no `permisos` management

**File:** `apps/web/src/pages/UsuariosPage.jsx` and `apps/web/src/pages/AdminUsuariosPage.jsx`
**Issue:** Both pages render the same "Usuarios del Sistema" heading (lines 253 and 169 respectively) and perform the same CRUD operations, but target different API routes (`/api/usuarios` vs `/api/admin/usuarios`), have divergent UI (one has permisos management, the other does not), divergent delete semantics (hard delete UI vs. soft deactivate), and divergent error-handling quality. This duplication guarantees future behavioral drift and bugs. The project should settle on a single page (likely `AdminUsuariosPage` given its `/api/admin/` route is the authoritative one per `admin.routes.ts`) and remove or clearly scope the other.

**Fix:** Consolidate to `AdminUsuariosPage`. Remove or repurpose `UsuariosPage` to avoid the two-page confusion. At minimum, add a comment at the top of each file clarifying which is authoritative.

---

## Info

### IN-01: Duplicate icon import in `UsuariosPage`

**File:** `apps/web/src/pages/UsuariosPage.jsx:15` and `apps/web/src/pages/UsuariosPage.jsx:21`
**Issue:** `WhatsAppIcon` is imported twice — once as `WhatsAppIcon` (line 15) and once as `WhatsAppIcon2` (line 21), both from the same `@mui/icons-material/WhatsApp` path. This is dead code duplication; `WhatsAppIcon2` is used only in the SIRH sync card (line 317).
**Fix:** Remove the `WhatsAppIcon2` import and use `WhatsAppIcon` throughout.

---

### IN-02: `rol: rest.rol as never` is a type-safety escape hatch

**File:** `apps/api/src/controllers/usuarios.controller.ts:86`
**Issue:** `rol: rest.rol as never` is used to silence a TypeScript error where `rest.rol` (typed as `string`) does not match Prisma's enum type. This suppresses the compiler check rather than validating the value. At runtime, any string (including invalid enum values) can be passed — Prisma will reject it with a database error rather than a clean 400.
**Fix:** Validate `rest.rol` against the enum before the Prisma call:
```typescript
import { RolSchema } from "@stf/shared";

const rolParsed = RolSchema.safeParse(rest.rol);
if (!rolParsed.success) {
  res.status(400).json({ error: "Rol inválido", campos: ["rol"] });
  return;
}
// Then use rolParsed.data instead of rest.rol as never
```

---

### IN-03: `AdminUsuariosPage` uses MUI (`@mui/material`) — project convention for `apps/web` is MUI v6, but `CLAUDE.md` states shadcn/ui for new components

**File:** `apps/web/src/pages/AdminUsuariosPage.jsx:2-8`
**Issue:** `CLAUDE.md` states "shadcn/ui para todos los componentes nuevos" and the global config also says "shadcn NO MUI" for SIAST. Both new pages use MUI extensively. This is a project convention violation. The existing `UsuariosPage` also uses MUI, so this is consistent with prior code, but new pages added in this phase should follow the stated convention.
**Fix:** For future pages or refactors, use shadcn/ui components per project convention. Flag for the next refactor cycle.

---

### IN-04: Magic number `10` for bcrypt rounds not extracted to a constant

**File:** `apps/api/src/controllers/usuarios.controller.ts:79` and `135`
**Issue:** `bcrypt.hash(password, 10)` hardcodes the salt rounds. This appears in two places. If the value ever needs to change (e.g., to 12 for higher security), it must be updated in multiple locations.
**Fix:**
```typescript
const BCRYPT_SALT_ROUNDS = 10;
// ...
await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
```

---

_Reviewed: 2026-05-25T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
