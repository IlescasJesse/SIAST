-- Agrega campos extendidos de SIRH a la tabla empleados
ALTER TABLE `empleados`
  ADD COLUMN `sirhId`            VARCHAR(24)  NULL UNIQUE AFTER `adscripcion`,
  ADD COLUMN `curp`              VARCHAR(18)  NULL AFTER `sirhId`,
  ADD COLUMN `numEmpleado`       INT          NULL AFTER `curp`,
  ADD COLUMN `numPlaza`          INT          NULL AFTER `numEmpleado`,
  ADD COLUMN `nivel`             VARCHAR(10)  NULL AFTER `numPlaza`,
  ADD COLUMN `fechaIngreso`      DATETIME(3)  NULL AFTER `nivel`,
  ADD COLUMN `grupoSangre`       VARCHAR(10)  NULL AFTER `fechaIngreso`,
  ADD COLUMN `sexo`              VARCHAR(1)   NULL AFTER `grupoSangre`,
  ADD COLUMN `vacacionesPeriodo` INT          NULL AFTER `sexo`,
  ADD COLUMN `vacacionesFecha`   VARCHAR(20)  NULL AFTER `vacacionesPeriodo`;
