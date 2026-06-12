-- AlterTable
ALTER TABLE `catalogo_recursos` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `unidades_recurso` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- RedefineIndex
CREATE INDEX `tickets_mueble_id_idx` ON `tickets`(`mueble_id`);
DROP INDEX `tickets_muebleId_idx` ON `tickets`;
