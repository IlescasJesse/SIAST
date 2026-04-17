-- AlterTable: add folio column to tickets
ALTER TABLE `tickets` ADD COLUMN `folio` VARCHAR(20) NOT NULL DEFAULT '';

-- Backfill existing rows with a temporary unique value based on id
UPDATE `tickets` SET `folio` = CONCAT('TIC-', LPAD(id, 4, '0')) WHERE `folio` = '';

-- Add unique constraint
ALTER TABLE `tickets` ADD UNIQUE INDEX `tickets_folio_key`(`folio`);
