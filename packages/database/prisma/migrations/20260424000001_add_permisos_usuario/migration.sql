-- Agregar columna permisos (JSON) a usuarios
-- Almacena permisos adicionales/overrides sobre los defaults del rol
ALTER TABLE `usuarios` ADD COLUMN `permisos` JSON NULL AFTER `activo`;
