-- Migration: add_areas_comunes_y_muebles
-- Adds esComun, tipoComun, nombrePropio to areas_edificio
-- Creates muebles table
-- Adds mueble_id FK to tickets

-- AlterTable areas_edificio
ALTER TABLE `areas_edificio`
  ADD COLUMN `esComun`      TINYINT(1)      NOT NULL DEFAULT 0,
  ADD COLUMN `tipoComun`    ENUM('SALA_JUNTAS','SALA_CONFERENCIAS','BANO','LACTANCIA','COPIADO','COMEDOR','RECEPCION','ARCHIVO','BODEGA','OTRO') NULL,
  ADD COLUMN `nombrePropio` VARCHAR(150)    NULL;

-- CreateTable muebles
CREATE TABLE `muebles` (
    `id`        INT              NOT NULL AUTO_INCREMENT,
    `areaId`    VARCHAR(100)     NOT NULL,
    `label`     VARCHAR(100)     NOT NULL,
    `tipo`      VARCHAR(50)      NOT NULL,
    `gridX`     DOUBLE           NOT NULL,
    `gridY`     DOUBLE           NOT NULL,
    `ancho`     DOUBLE           NOT NULL DEFAULT 1.0,
    `alto`      DOUBLE           NOT NULL DEFAULT 1.0,
    `activo`    TINYINT(1)       NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `muebles_areaId_idx`(`areaId`),
    INDEX `muebles_activo_idx`(`activo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey muebles -> areas_edificio
ALTER TABLE `muebles`
  ADD CONSTRAINT `muebles_areaId_fkey`
  FOREIGN KEY (`areaId`) REFERENCES `areas_edificio`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable tickets: add mueble_id
ALTER TABLE `tickets`
  ADD COLUMN `mueble_id` INT NULL;

-- CreateIndex on tickets.mueble_id
CREATE INDEX `tickets_muebleId_idx` ON `tickets`(`mueble_id`);

-- AddForeignKey tickets -> muebles
ALTER TABLE `tickets`
  ADD CONSTRAINT `tickets_mueble_id_fkey`
  FOREIGN KEY (`mueble_id`) REFERENCES `muebles`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
