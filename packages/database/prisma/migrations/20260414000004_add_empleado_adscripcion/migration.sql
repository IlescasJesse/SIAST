-- Agrega columna adscripcion a empleados (nombre de adscripción SIRH)
ALTER TABLE `empleados`
  ADD COLUMN `adscripcion` VARCHAR(200) NULL AFTER `puesto`;
