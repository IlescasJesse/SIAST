-- AlterTable
ALTER TABLE `catalogo_recursos` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `muebles` ADD COLUMN `rotacion` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `unidades_recurso` ALTER COLUMN `updatedAt` DROP DEFAULT;
