# 03-04-SUMMARY — Frontend

**Estado:** ✅ COMPLETADO  
**Fecha:** 2026-05-13

## Cambios realizados

### apps/web/src/api/catalogos.js
- `getAreasSoporte()` exportada — GET /api/admin/areas-soporte

### apps/web/src/api/admin.js
- `getAreasSoporte()` exportada — GET /api/admin/areas-soporte (mismo endpoint)

### apps/web/src/pages/UsuariosPage.jsx
- `ROLES_STAFF` extendido con 14 roles (incluyendo RESPONSABLE_* y nuevos TECNICO_*)
- `RESPONSABLE_ROLES` constante con los 4 roles RESPONSABLE_*
- `emptyForm` incluye `areaSoporteId: null`
- `useEffect` carga áreas de soporte al montar
- `openEditar` popula `areaSoporteId` desde datos del usuario
- `handleGuardar` limpia `areaSoporteId` si rol no es RESPONSABLE_*
- Selector `Área de Soporte` condicional después del rol (solo visible para RESPONSABLE_*)

### apps/web/src/pages/AdminUsuariosPage.jsx
- `ROLES` extendido con 14 roles
- `RESPONSABLE_ROLES` constante
- `EMPTY_FORM` incluye `areaSoporteId: null`
- `useEffect` carga áreas de soporte al montar
- `abrirEditar` popula `areaSoporteId` desde datos del usuario
- `handleRolChange` limpia `areaSoporteId` cuando newRol no es RESPONSABLE_*
- Selector `Área de Soporte` condicional antes de la sección de permisos

### apps/web/src/store/notificaciones.js
- `join:admin` emitido también para los 4 roles RESPONSABLE_* (reciben notificaciones ticket:nuevo)

## Verificación
- ✅ `npm run build --workspace=apps/web` — Build exitoso sin errores
- ✅ ROLES_STAFF + ADMIN_ROLES extendidos con los 14 roles
- ✅ Selector AreaSoporte visible solo para RESPONSABLE_*
- ✅ Payload cleanup: areaSoporteId = null para roles no-RESPONSABLE_*
- ✅ handleRolChange resetea areaSoporteId al cambiar a rol no-RESPONSABLE_*
- ✅ RESPONSABLE_* se une a room admins en Socket.IO
