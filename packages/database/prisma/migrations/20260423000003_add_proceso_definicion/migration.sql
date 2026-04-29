-- Agregar campos a pasos_ticket
ALTER TABLE `pasos_ticket`
  ADD COLUMN `nombre` VARCHAR(150) NULL AFTER `orden`,
  ADD COLUMN `cantidad_unidades` INT NULL AFTER `notas`,
  ADD COLUMN `label_unidades` VARCHAR(100) NULL AFTER `cantidad_unidades`;

-- Crear tabla procesos_definicion
CREATE TABLE `procesos_definicion` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `subcategoria` ENUM('SISTEMAS_INSTITUCIONALES','EQUIPOS_DISPOSITIVOS','RED_INTERNET','CUENTAS_DOMINIO','CORREO_OUTLOOK','SANITARIOS','ILUMINACION','MOVILIDAD','SALA_JUNTAS','EQUIPO_AUDIOVISUAL','PRESTAMO_EQUIPO','MOBILIARIO','PAPELERIA') NOT NULL,
  `sub_tipo` VARCHAR(50) NULL,
  `tipo_flujo` VARCHAR(20) NOT NULL DEFAULT 'DIRECTO',
  `nombre` VARCHAR(150) NOT NULL,
  `descripcion` VARCHAR(300) NULL,
  `activo` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `procesos_definicion_subcategoria_sub_tipo_key` (`subcategoria`, `sub_tipo`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Crear tabla pasos_definicion
CREATE TABLE `pasos_definicion` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `proceso_id` INT NOT NULL,
  `orden` INT NOT NULL,
  `rol_requerido` VARCHAR(50) NOT NULL,
  `nombre` VARCHAR(150) NOT NULL,
  `descripcion` VARCHAR(300) NULL,
  `registra_unidades` BOOLEAN NOT NULL DEFAULT false,
  `label_unidades` VARCHAR(100) NULL,
  PRIMARY KEY (`id`),
  INDEX `pasos_definicion_proceso_id_idx` (`proceso_id`),
  CONSTRAINT `pasos_definicion_proceso_id_fkey` FOREIGN KEY (`proceso_id`) REFERENCES `procesos_definicion`(`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
