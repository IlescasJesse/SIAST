# 03-01-SUMMARY — Schema y Tipos Compartidos

**Estado:** ✅ COMPLETADO  
**Fecha:** 2026-05-13

## Cambios realizados

### packages/database/prisma/schema.prisma
- Enum `Rol` extendido de 7 a 14 valores (agregados RESPONSABLE_TI, RESPONSABLE_REDES, RESPONSABLE_MANTENIMIENTO, RESPONSABLE_RECURSOS_MATERIALES, TECNICO_ELECTRICISTA, TECNICO_PLOMERO, TECNICO_MOVILIDAD)
- `TECNICO_SERVICIOS` preservado (no eliminado)
- Nuevo modelo `AreaSoporte` con campos: id, nombre (unique), subcategorias Json, rolesIncluidos Json, activo, createdAt
- Campo `areaSoporteId Int?` agregado al modelo `Usuario` con relación FK a `AreaSoporte`

### packages/shared/src/index.ts
- `RolSchema` extendido con 7 nuevos valores
- `LABEL_ROL` extendido con 7 nuevas etiquetas
- `PERMISOS_DEFAULT` extendido con entradas para los 7 nuevos roles
  - RESPONSABLE_*: permisos amplios (ver_todas, asignar, pasos.asignar, metricas.ver)
  - TECNICO_ELECTRICISTA/PLOMERO/MOVILIDAD: solo ver_todas

## Verificación
- ✅ `npx prisma validate` — schema válido
- ✅ `npm run build --workspace=packages/shared` — build limpio
- ✅ TECNICO_SERVICIOS preservado en schema y shared
- ✅ AreaSoporte model existe con campos Json
- ✅ RESPONSABLE_TI aparece 3 veces en shared (RolSchema + LABEL_ROL + PERMISOS_DEFAULT)
