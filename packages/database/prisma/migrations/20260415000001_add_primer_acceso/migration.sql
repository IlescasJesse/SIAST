-- Agrega control de primer acceso y fecha de último acceso a empleados
ALTER TABLE `empleados`
  ADD COLUMN `primerAcceso`      BOOLEAN   NOT NULL DEFAULT true AFTER `telefono`,
  ADD COLUMN `fechaUltimoAcceso` DATETIME(3) NULL    AFTER `primerAcceso`;
