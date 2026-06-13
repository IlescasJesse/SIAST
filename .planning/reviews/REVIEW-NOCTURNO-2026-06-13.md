# Review Nocturno — 2026-06-13

**Sistema:** SIAST — Sistema Integral de Atención y Soporte Técnico  
**Revisión:** Automatizada (scheduled task) — revisión de seguridad + coherencia de módulos  
**Commit base:** `9abf45a` — fix(db): delete-areas borra muebles primero (FK Restrict)  
**Fase activa:** Phase 5 — Reportes Exportables (pendiente)  
**MySQL:** ✅ Disponible (XAMPP)  
**TypeScript (apps/api):** ✅ Sin errores  
**TypeScript (apps/web):** ⚠️ tsconfig.json no encontrado en raíz de apps/web — no evaluable  
**Lint:** ⚠️ Sin linter configurado en workspaces (api, shared, ui)

---

## Resumen Ejecutivo

Revisión adversarial completada sobre seguridad gubernamental, coherencia entre módulos y calidad monorepo.

- **0 CRÍTICO** — Sin regresiones en seguridad core (OTP, JWT, CORS, rate limit).
- **4 ALTO** — Fuga de datos personales en `/me`, datos de adscripción no persistidos en áreas, seed incompleto (solo ADMIN), y 3 roles GESTOR bloqueados en recursos.
- **4 MEDIO** — Empleados soft-deleted expuestos, vulnerabilidad `ws` parcheable, campo `recursosAdicionales` invisible para técnicos, rol deprecated activo.
- **2 BAJO** — Dependencia `xlsx` sin fix upstream, etiquetas de pisos confusas.

Prioridad inmediata: hallazgos ALTO 1 y 3 (fuga de datos personales + permisos rotos en gestores).

---

## Tabla de Hallazgos

| #   | Severidad | Módulo                | Archivo:Línea                                                                      | Descripción                                                                                                                                                                                                                                                                                                                                                             | Fix Propuesto                                                                                                                                                                                              |
| --- | --------- | --------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **ALTO**  | Seguridad / Auth      | `apps/api/src/controllers/auth.controller.ts:153-157`                              | Endpoint `GET /me` para EMPLEADO usa `findUnique` sin `select`: devuelve `telefono` en claro, `curp`, `sexo`, `grupoSangre`, `numEmpleado`, `numPlaza`. Datos personales sensibles expuestos al cliente en cada sesión.                                                                                                                                                 | Agregar `select` explícito con solo los campos necesarios (`rfc`, `nombreCompleto`, `email`, `rol`, `areaSoporteId`). Aplicar `maskTelefono` si el teléfono debe mostrarse.                                |
| 2   | **ALTO**  | Mapa de Áreas         | `apps/api/src/controllers/catalogos.controller.ts:177`                             | `CreateAreaSchema` y `UpdateAreaSchema` no declaran `adscripcionNombre` ni `adscripcionNivel`. Zod los descarta silenciosamente. `AreasPage.jsx:694-697` los envía al crear un área nueva. Los campos existen en el schema Prisma (`AreaEdificio:265-266`) pero nunca se persisten. El selector SIRH en el modal de nueva área es completamente inerte.                 | Agregar `adscripcionNombre: z.string().max(200).optional()` y `adscripcionNivel: z.number().int().optional()` al `CreateAreaSchema` y `UpdateAreaSchema`; propagar en `prisma.areaEdificio.create/update`. |
| 3   | **ALTO**  | Roles / Seed          | `packages/database/prisma/seed.ts:109`                                             | Solo el usuario ADMIN es sembrado. 16 de 17 roles del enum no tienen usuario de prueba. En entorno de desarrollo limpio, es imposible probar flujos de técnico, responsable, gestor o mesa de ayuda sin crear usuarios manualmente.                                                                                                                                     | Agregar bloque de usuarios de prueba con uno por cada rol activo, contraseñas conocidas y `areaSoporteId` asignado para los RESPONSABLE\_\*.                                                               |
| 4   | **ALTO**  | Roles / Recursos      | `apps/api/src/routes/recursos.routes.ts:14,20,26,32,40,46,52,59,65,71,78,84,90,96` | `GESTOR_SALAS_JUNTA`, `GESTOR_RECURSOS` y `GESTOR_INVENTARIO` reciben 403 en todos los endpoints de `/api/recursos`. La UI los muestra en sus áreas de soporte y en los formularios de usuario, pero el backend nunca los incluyó en los `requireRol` de recursos. Adicionalmente, `RecursosPage.jsx:262` solo admite `GESTOR_RECURSOS_MATERIALES` en `puedeGestionar`. | Agregar los 3 roles al array de `requireRol` en cada método de `recursos.routes.ts` según corresponda. Expandir `puedeGestionar` en `RecursosPage.jsx`.                                                    |
| 5   | **MEDIO** | Seguridad / Empleados | `apps/api/src/controllers/empleados.controller.ts:11-14`                           | `GET /api/empleados/ubicacion/:rfc` consulta sin `activo: true` — devuelve empleados con soft delete. La ruta solo exige `authMiddleware` sin `requireRol`, exponiendo `rfc` y `nombreCompleto` a cualquier usuario autenticado.                                                                                                                                        | Añadir `activo: true` al `where`. Evaluar si se necesita restricción de rol (MESA*AYUDA / TECNICO*\*).                                                                                                     |
| 6   | **MEDIO** | Dependencias          | `node_modules/ws` (via `socket.io-adapter`, `engine.io`)                           | `ws` 8.x: divulgación de memoria no inicializada (GHSA-58qx-3vcg-4xpx). Socket.IO está en uso activo (`apps/api/src/index.ts:44`). Fix disponible via `npm audit fix`.                                                                                                                                                                                                  | Ejecutar `npm audit fix` y verificar que Socket.IO arranca correctamente.                                                                                                                                  |
| 7   | **MEDIO** | recursosAdicionales   | `apps/web/src/pages/SolicitudDetailPage.jsx` (ausencia verificada)                 | El detalle de la solicitud no renderiza `recursosAdicionales`. Técnicos y mesa de ayuda no pueden ver las preferencias de sala, equipo audiovisual o equipo en préstamo que el empleado especificó. La información solo es visible en `RecursosPage.jsx` para gestores.                                                                                                 | Agregar bloque de parseo análogo al de `RecursosPage.jsx:1551-1589` en la sección de detalles del ticket en `SolicitudDetailPage`.                                                                         |
| 8   | **MEDIO** | Roles / Deprecated    | `apps/api/src/controllers/catalogos.controller.ts:36`                              | `TECNICO_SERVICIOS` marcado como deprecated en `schema.prisma:21` aún aparece en el listado de técnicos del endpoint `GET /api/catalogos/tecnicos`. Sin riesgo de seguridad inmediato, pero inconsistente con la deprecación declarada.                                                                                                                                 | Documentar explícitamente que el rol se mantiene por retrocompatibilidad, o filtrarlo en el endpoint cuando se decida eliminar.                                                                            |
| 9   | **BAJO**  | Dependencias          | `node_modules/xlsx`                                                                | `xlsx *`: prototype pollution (GHSA-4r6h-8v6p-xvw6) + ReDoS (GHSA-5pgg-2g8v-p4x9). Sin fix upstream. No se importa en `apps/api/src` — no explotable en la API hoy.                                                                                                                                                                                                     | Identificar qué workspace lo instala. Si no se usa, eliminar. Si es apps/web, evaluar alternativa (ExcelJS).                                                                                               |
| 10  | **BAJO**  | Mapa de Áreas         | `apps/api/src/controllers/catalogos.controller.ts:119-126`                         | El endpoint `/api/catalogos/pisos` etiqueta `NIVEL_1` como "Nivel 2", `NIVEL_2` como "Nivel 3", etc. (floor=0=PB, 1=2do piso real). Ningún componente activo consume el endpoint, pero es confuso para consumidores futuros.                                                                                                                                            | Documentar o alinear la convención de pisos en el endpoint.                                                                                                                                                |

---

## Coherencia entre Módulos

### Cadena Mapa de Áreas: `AreasPage` → API → `AreaEdificio` → Visor 3D

| Punto                           | Estado      | Detalle                                                                                                          |
| ------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------- |
| Frontend (`apps/web`) → Backend | ✅          | `AreasPage.jsx` llama `GET /api/catalogos/areas` y `POST/PUT/DELETE` del mismo prefijo                           |
| Backend → Prisma                | ✅          | `catalogos.controller.ts` usa `prisma.areaEdificio.findMany/create/update/delete`                                |
| Campos en tránsito              | ✅          | `id, label, piso, floor, gridX1-Y1-X2-Y2, esComun, tipoComun, nombrePropio, esSalaJuntas, colorHex` consistentes |
| Visor 3D → API                  | ✅          | `apps/modelado-3d/src/main.js:176` consume `GET /api/catalogos/areas` directamente                               |
| `adscripcionNombre/Nivel`       | ❌ **ALTO** | Enviados desde frontend, descartados por Zod, nunca persistidos (ver hallazgo #2)                                |

### Cadena `recursosAdicionales`

| Punto                              | Estado       | Detalle                                                                                     |
| ---------------------------------- | ------------ | ------------------------------------------------------------------------------------------- |
| Schema Prisma                      | ✅           | `Ticket.recursosAdicionales String?` — campo String para JSON                               |
| Serialización backend              | ✅           | `tickets.service.ts:241-247` — `JSON.stringify` antes de guardar, con guard si ya es string |
| Renderizado en RecursosPage        | ✅           | `RecursosPage.jsx:1553-1556` — `JSON.parse` dentro de try/catch                             |
| Renderizado en SolicitudDetailPage | ❌ **MEDIO** | Campo ausente; técnicos no ven recursos solicitados (ver hallazgo #7)                       |

### Cadena Métricas y `areaSoporteId`

| Punto                                 | Estado | Detalle                                                                                        |
| ------------------------------------- | ------ | ---------------------------------------------------------------------------------------------- |
| JWT incluye `areaSoporteId`           | ✅     | `auth.service.ts:121-122` — añadido condicionalmente cuando `user.areaSoporteId != null`       |
| Scoping RESPONSABLE\_\*               | ✅     | `metricas.controller.ts:88-93` — `areaSoporteId` del JWT sobreescribe cualquier query param    |
| Bloqueo TECNICO\_\* a tipo=proceso    | ✅     | `metricas.controller.ts:76-79` — 403 si intenta tipo distinto a "proceso"                      |
| Cross-área bloqueado para RESPONSABLE | ✅     | `metricas.controller.ts:101-113` — valida que técnico pertenezca al área del responsable       |
| GESTOR\_\* excluidos de métricas      | ⚠️     | `metricas.routes.ts` — no tienen acceso; comportamiento parece intencional pero no documentado |

### Cadena Roles

| Punto                           | Estado      | Detalle                                                                           |
| ------------------------------- | ----------- | --------------------------------------------------------------------------------- |
| Enum Rol en schema              | ✅          | 17 valores documentados                                                           |
| Guards en admin/usuarios routes | ✅          | `requireRol("ADMIN")` global en ambas rutas                                       |
| Guards en tickets routes        | ✅          | GESTOR*\* y RESPONSABLE*\* incluidos correctamente                                |
| Guards en recursos routes       | ❌ **ALTO** | GESTOR_SALAS_JUNTA, GESTOR_RECURSOS, GESTOR_INVENTARIO ausentes (ver hallazgo #4) |
| Seed con usuarios por rol       | ❌ **ALTO** | Solo ADMIN sembrado (ver hallazgo #3)                                             |

---

## Verificados Sin Problema

| Área                              | Detalle                                                                                                                                                              |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OTP bcrypt                        | Hash en `otp.service.ts:56`, compare timing-safe con dummy hash anti-enumeración (`:196-198`), TTL 10 min, invalidación al regenerar, código jamás en respuesta HTTP |
| JWT_SECRET                        | Validado en `jwt.ts:4-6` e `index.ts:26-28`; API falla al arrancar si falta; sin fallback hardcodeado                                                                |
| CORS                              | Whitelist obligatoria desde `CORS_ORIGINS` (`index.ts:29-34,56-61`); sin `origin: '*'`; Helmet activo                                                                |
| Rate limiting                     | 5 intentos/15min en `solicitar-otp`, `verificar-otp`, `login`, `refresh` (`auth.routes.ts:8-12`)                                                                     |
| Raw queries                       | `metricas.service.ts` — todas usan `Prisma.sql` template tags parametrizados; sin interpolación de strings                                                           |
| Soft delete tickets               | `tickets.service.ts:559` — `activo: false`                                                                                                                           |
| Soft delete usuarios              | `usuarios.controller.ts:161-164` — `activo: false`                                                                                                                   |
| devCodigo no fuga                 | `whatsapp.service.ts:304` — comentario explícito `// SIN devCodigo`; nunca en respuesta HTTP                                                                         |
| Secrets hardcodeados              | Cero literales de clave/password/token en `.ts`; `.env` y `apps/api/.env` en `.gitignore`                                                                            |
| jti revocación JWT                | Refresh usa `jti` blacklist (`auth.controller.ts:126-132`)                                                                                                           |
| TypeScript API                    | `npx tsc --noEmit` — sin errores                                                                                                                                     |
| Cadena áreas (campos principales) | Consistente entre frontend, API, Prisma y visor 3D para todos los campos excepto adscripción                                                                         |
| Métricas scoping                  | Implementación correcta y completa — areaSoporteId forzado desde JWT, cross-área bloqueado                                                                           |

---

## Siguiente Paso Recomendado

**Prioridad 1 (seguridad):** Corregir hallazgo #1 — `auth.controller.ts:153` — agregar `select` explícito en `GET /me` para EMPLEADO. Datos personales (`telefono`, `curp`, `sexo`, `grupoSangre`) no deben llegar al cliente.

**Prioridad 2 (permisos rotos):** Corregir hallazgo #4 — `recursos.routes.ts` — agregar `GESTOR_SALAS_JUNTA`, `GESTOR_RECURSOS`, `GESTOR_INVENTARIO` a los `requireRol` relevantes. Actualmente esos roles tienen acceso 0 a recursos a pesar de que la UI los muestra como parte del área.

**Prioridad 3 (datos perdidos silenciosamente):** Corregir hallazgo #2 — `catalogos.controller.ts:177` — persistir `adscripcionNombre`/`adscripcionNivel` al crear/actualizar áreas.

**Antes de Phase 5:** Ejecutar `npm audit fix` (hallazgo #6 — `ws` con fix disponible).
