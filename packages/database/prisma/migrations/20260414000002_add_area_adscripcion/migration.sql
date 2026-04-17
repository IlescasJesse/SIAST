-- AlterTable: add adscripcion fields to areas_edificio
ALTER TABLE `areas_edificio`
  ADD COLUMN `adscripcionNombre` VARCHAR(200) NULL,
  ADD COLUMN `adscripcionNivel` INT NULL;
