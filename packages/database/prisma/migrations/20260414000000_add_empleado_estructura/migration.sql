-- AlterTable
ALTER TABLE `usuarios` ADD COLUMN `esEmpleadoEstructura` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `empleadoId` VARCHAR(24) NULL,
    ADD COLUMN `rfc` VARCHAR(13) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `usuarios_empleadoId_key` ON `usuarios`(`empleadoId`);

-- CreateIndex
CREATE UNIQUE INDEX `usuarios_rfc_key` ON `usuarios`(`rfc`);
