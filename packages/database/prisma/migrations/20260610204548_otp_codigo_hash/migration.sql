-- AlterTable
ALTER TABLE `catalogo_recursos` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `otp_tokens` MODIFY `codigo` VARCHAR(72) NOT NULL;

-- AlterTable
ALTER TABLE `unidades_recurso` ALTER COLUMN `updatedAt` DROP DEFAULT;
