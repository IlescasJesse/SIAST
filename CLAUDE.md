# SIAST — Secretaría de Finanzas del Estado de Oaxaca

## Stack

Express + TypeScript + Prisma + Socket.IO (API) + Vite + React + MUI v6 (Web) + Three.js (3D)
Monorepo: npm workspaces (`apps/web`, `apps/api`, `apps/modelado-3d`, `packages/shared`, `packages/ui`, `packages/database`)

> ⚠️ UI: **MUI v6** en `apps/web` — `packages/ui` tiene componentes shadcn/ui pero NO se usan en páginas

## Contexto de Dominio

- Sistema gubernamental — Secretaría de Finanzas, Oaxaca
- Usuarios: funcionarios del gobierno estatal
- Datos fiscales y presupuestales
- Cumplir normativas de gobierno digital mexicano

## Notas importantes

- Empleados se autentican solo con RFC (sin contraseña).
- Staff (Admin, Técnicos, Mesa Ayuda) usan usuario + contraseña.
- Máximo 4 tickets activos por empleado simultáneamente (constante `MAX_TICKETS_ACTIVOS_EMPLEADO` en `@stf/shared`).
- Soft delete en tickets: `activo = false` en lugar de borrado físico.
- Los packages se referencian: `@stf/shared`, `@stf/ui`, `@stf/database`.

## Al agregar features

- Verificar si la feature depende del mock o necesita DB real
- Si requiere DB: implementar schema Prisma primero
- Mantener tipos en `packages/shared`
- shadcn/ui para todos los componentes nuevos

---

## Agentes disponibles

Usa `/agent` para invocar un agente especializado según la tarea:

| Agente                | Invocar con                  | Cuándo usarlo                                                                                  |
| --------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------- |
| `modelado-3d`         | `/agent modelado-3d`         | Three.js, GLB, raycasting, pins, visor edificio                                                |
| `senior-programacion` | `/agent senior-programacion` | Arquitectura, features fullstack, revisión de código                                           |
| `analizador-db`       | `/agent analizador-db`       | Esquema DB, migraciones, queries, análisis de datos                                            |
| `revisor-seguridad`   | `/agent revisor-seguridad`   | Auditoría de seguridad: OTP, JWT, CORS, roles, soft delete — antes de deploy o tras tocar auth |
| `orquestador`         | `/agent orquestador`         | Inicio de sesión o alcance no claro — mapa de alcance + plan de delegación                     |

---

## Arquitectura

Monorepo con **npm workspaces**:

```
apps/
  api/          # Express 5 + TypeScript + Prisma + Socket.IO (puerto 5101)
  web/          # Vite + React (puerto 5173)
packages/
  shared/       # tipos Zod SIAST: Ticket, Empleado, Rol, etc.
  ui/           # componentes base: Button, Card, Input, Table, Badge
  database/     # Prisma schema + seed + migraciones (MySQL)
```

## Requisito: MySQL

La API requiere MySQL (MariaDB via XAMPP). Iniciar antes de `npm run dev:api`.
Puertos: API 5101, Web 5173, Visor 3D 5174, Prisma Studio 5555.

---

## Estilo de código

Prettier: `semi: true`, `singleQuote: false`, `trailingComma: "all"`, `printWidth: 100`.

---

## Comandos

Desde la raíz del monorepo:

```bash
npm install          # instalar dependencias
npm run dev          # corre api + web en paralelo
npm run dev:api      # solo la API Express (puerto 5101)
npm run dev:web      # solo el frontend Vite (puerto 5173)
npm run build        # build de todos los workspaces
npm run lint         # lint de todos los workspaces
npm run format       # prettier en todo el repo
```

Dentro de `packages/database`:

```bash
npm run db:migrate   # prisma migrate dev
npm run db:generate  # prisma generate
npm run db:seed      # tsx prisma/seed.ts
npm run db:studio    # prisma studio (puerto 5555)
```

---

## Abrir este repo desde Claude Desktop (sin terminal)

Repo remoto: `https://github.com/IlescasJesse/SIAST.git`, rama `main`.

1. Abrir la app **Claude Desktop** (Windows/Mac/Linux) — trae Chat + Code en una ventana, mismo motor que la CLI.
2. Ir a la pestaña **Code**.
3. Abrir carpeta local: `C:\Users\JESSE ILESCAS\Documents\siast` (ya clonado, ya con este `CLAUDE.md` — se carga automático igual que en la CLI).
4. Requiere lo mismo que la CLI: MySQL/XAMPP corriendo antes de `npm run dev` (ver [Requisito: MySQL](#requisito-mysql)) y `packages/database/.env` con `DATABASE_URL`.
5. Mismos comandos, mismos hooks, mismos slash commands — solo cambia la interfaz (diff viewer, árbol de archivos, terminal integrada visible en vez de manejarla tú).

## Estado Actual (actualizado 2026-09-17)

- Backend 100% en Prisma + MySQL (mock data ya migrado)
- SIRH implementado (`sirh.service.ts`) — activar con `SIRH_ENABLED=true` en `.env` del API
- Enum `Rol`: **19 valores** — ver `packages/database/prisma/schema.prisma`
- Fase actual del roadmap: **Phase 5 — Reportes Exportables**, no iniciada
- Deploy: VPS con PM2 en `/opt/siast`, sin Docker

### Feedback staff (reunión 2026-08-12) — seguimiento

11 de 13 puntos cerrados. Ver memoria del proyecto para detalle de cada uno.

**Hechos:**

- P1 — reasignación entre áreas, prioridad manual, bloqueo de solicitudes repetitivas
- P2 — fórmula de productividad + responsables resuelven directo, verificación por correo
- P2 — bloqueo de IP progresivo: 5 intentos fallidos → 3 min bloqueo, +2 min por reincidencia (reset a los 24h sin bloqueos); aviso de intentos restantes en `LoginPage`
- P3-7 — conteo de tickets activos por técnico al asignar
- P3-9 — perfil obligatorio (correo institucional `@finanzasoaxaca.gob.mx` o personal + ubicación), con redirect correcto tras guardar
- P4-11 — organigrama (`/organigrama`): Admin → Mesa de Ayuda → Responsables por área → Técnicos por área → Gestores/otros, con usuarios reales de DB (nivel EMPLEADO vacío, se autentican por RFC/SIRH y no tienen fila en `Usuario`)
- P4-12 — registro de personal por honorarios (invitados), autenticación por RFC igual que empleado
- _(extra)_ sistema unificado de alertas/confirmación (`apps/web/src/store/dialogs.js`) — reemplaza `window.confirm`/`alert`
- _(extra)_ fix: 401 de login/OTP disparaba `forceLogout()` (reload de página) antes de mostrar el aviso de intentos restantes
- _(extra)_ fix: sync SIRH truena por RFC duplicado entre empleados (`empleados_rfc_key`) — ahora actualiza todo menos el RFC y loguea para revisión manual

**Pendientes:**

- P3-8 (categoría telefonía + Osticket) — bloqueado, requiere definición con equipo de redes
- P4-10 (formato de registro redes/dominio) — bloqueado, espera formato de Ramiro
- P4-13 (nuevo teléfono de Mesa de Ayuda) — trivial, falta el número
