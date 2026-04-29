/*
  Warnings:

  - The values [TECNICO_INFORMATICO,TECNICO_SOPORTE_TI] on the enum `usuarios_rol` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the `recursos_legacy` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `pasos_definicion` DROP FOREIGN KEY `pasos_definicion_proceso_id_fkey`;

-- AlterTable
ALTER TABLE `catalogo_recursos` ADD COLUMN `requiereHorario` BOOLEAN NOT NULL DEFAULT false,
    ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `procesos_definicion` ALTER COLUMN `tipo_flujo` DROP DEFAULT;

-- AlterTable
ALTER TABLE `tickets` ALTER COLUMN `folio` DROP DEFAULT;

-- AlterTable
ALTER TABLE `unidades_recurso` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `usuarios` MODIFY `rol` ENUM('ADMIN', 'TECNICO_TI', 'TECNICO_REDES', 'TECNICO_SERVICIOS', 'MESA_AYUDA', 'GESTOR_RECURSOS_MATERIALES', 'EMPLEADO') NOT NULL;

-- DropTable
DROP TABLE `recursos_legacy`;

-- AddForeignKey
ALTER TABLE `logs_acceso` ADD CONSTRAINT `logs_acceso_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `logs_acceso` ADD CONSTRAINT `logs_acceso_empleado_rfc_fkey` FOREIGN KEY (`empleado_rfc`) REFERENCES `empleados`(`rfc`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pasos_definicion` ADD CONSTRAINT `pasos_definicion_proceso_id_fkey` FOREIGN KEY (`proceso_id`) REFERENCES `procesos_definicion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- RedefineIndex
CREATE INDEX IF NOT EXISTS `asignaciones_recursos_unidadId_idx` ON `asignaciones_recursos`(`unidadId`);
DROP INDEX IF EXISTS `asignaciones_recursos_unidadId_fkey` ON `asignaciones_recursos`;

-- RedefineIndex
CREATE UNIQUE INDEX IF NOT EXISTS `empleados_sirhId_key` ON `empleados`(`sirhId`);
DROP INDEX IF EXISTS `sirhId` ON `empleados`;
