-- Agregar nuevos roles al enum de usuarios (idempotente — mismos valores)
ALTER TABLE `usuarios` MODIFY COLUMN `rol` ENUM(
  'ADMIN','TECNICO_INFORMATICO','TECNICO_SOPORTE_TI','TECNICO_REDES',
  'TECNICO_SERVICIOS','MESA_AYUDA','GESTOR_RECURSOS_MATERIALES','EMPLEADO'
) NOT NULL;

-- Agregar subTipo al ticket (AFTER recursosAdicionales — nombre real de la columna en DB)
ALTER TABLE `tickets` ADD COLUMN `sub_tipo` VARCHAR(50) NULL AFTER `recursosAdicionales`;

-- Crear tabla pasos_ticket
CREATE TABLE `pasos_ticket` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `ticket_id` INT NOT NULL,
  `orden` INT NOT NULL,
  `rol_requerido` VARCHAR(50) NOT NULL,
  `tecnico_id` INT NULL,
  `estado` VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
  `notas` TEXT NULL,
  `completado_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `pasos_ticket_ticket_id_idx` (`ticket_id`),
  CONSTRAINT `pasos_ticket_ticket_id_fkey` FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `pasos_ticket_tecnico_id_fkey` FOREIGN KEY (`tecnico_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
