# 03-03-SUMMARY — Backend Guards

**Estado:** ✅ COMPLETADO  
**Fecha:** 2026-05-13

## Cambios realizados

### apps/api/src/middleware/roles.middleware.ts
- `ROLES_RESPONSABLE` array exportado con los 4 roles RESPONSABLE_*
- `requireResponsableDeArea()` middleware async con DB read para scope de área
- Import de `prisma` singleton agregado

### apps/api/src/routes/tickets.routes.ts
- Rutas extendidas con nuevos roles:
  - `/asignar`: ADMIN + RESPONSABLE_*
  - `/estado`: ADMIN + todos TECNICO_* + RESPONSABLE_* + EMPLEADO
  - `/comentarios`: ADMIN + MESA_AYUDA + todos TECNICO_* + RESPONSABLE_*
  - `/pasos/completar`: todos TECNICO_* (incluyendo nuevos)
  - `/pasos/asignar`: ADMIN + MESA_AYUDA + RESPONSABLE_*

### apps/api/src/services/tickets.service.ts
- `CATEGORIA_ROL_MAP.SERVICIOS` actualizado con TECNICO_ELECTRICISTA, PLOMERO, MOVILIDAD
- `ROLES_RESPONSABLE` constante a nivel de módulo
- `asignarTicket`: guard que verifica que técnico pertenece al área del responsable
- `cambiarEstado`: guard que verifica subcategoría del ticket contra el área del responsable
- `listarTickets`:
  - Branch para nuevos TECNICO_ELECTRICISTA/PLOMERO/MOVILIDAD (misma lógica que existentes)
  - Branch para RESPONSABLE_* (filtra por subcategorías de su área)
- Bug fix `crearTicket`: `["TECNOLOGIAS", "SERVICIOS"].includes(categoriaVal)` (antes solo TECNOLOGIAS)

### apps/api/src/controllers/usuarios.controller.ts
- `userSelect` extendido con `areaSoporteId` y `areaSoporte.nombre`
- `crear`: desestructura areaSoporteId, validación RESPONSABLE_* requiere areaSoporteId
- `actualizar`: limpieza de areaSoporteId cuando rol cambia a no-RESPONSABLE_*

### apps/api/src/routes/admin.routes.ts
- Handler inline `listarAreasSoporte` con `prisma.areaSoporte.findMany()`
- GET `/areas-soporte` registrado bajo router de admin (protegido por requireRol("ADMIN"))

## Verificación
- ✅ `npm run build --workspace=apps/api` — Build exitoso sin errores TypeScript
- ✅ `requireResponsableDeArea()` exportada con DB read
- ✅ Rutas de tickets con requireRol completo para todos los roles nuevos
- ✅ CATEGORIA_ROL_MAP.SERVICIOS con roles MANTENIMIENTO
- ✅ Bug fix crearTicket: pasos generados para SERVICIOS
- ✅ Guards RESPONSABLE_* en asignarTicket y cambiarEstado
- ✅ Branch RESPONSABLE_* en listarTickets
- ✅ areaSoporteId en userSelect, crear, actualizar
- ✅ GET /areas-soporte endpoint
