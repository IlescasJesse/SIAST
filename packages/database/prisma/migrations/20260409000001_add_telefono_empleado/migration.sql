-- Migration: add_telefono_empleado
-- Agrega columna telefono a empleados para OTP vía WhatsApp

ALTER TABLE `empleados`
  ADD COLUMN `telefono` VARCHAR(20) NULL AFTER `email`;
