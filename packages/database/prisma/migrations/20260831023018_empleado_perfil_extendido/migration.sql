-- Datos de perfil capturados por el empleado (feedback staff P3-9, 2026-08-31)
ALTER TABLE `empleados`
  ADD COLUMN `correoInstitucional` VARCHAR(200) NULL,
  ADD COLUMN `emailPersonal` VARCHAR(200) NULL,
  ADD COLUMN `extension` VARCHAR(10) NULL,
  ADD COLUMN `perfilCompleto` BOOLEAN NOT NULL DEFAULT false;
