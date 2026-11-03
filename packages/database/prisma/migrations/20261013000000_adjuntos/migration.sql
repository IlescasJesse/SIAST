-- Adjuntos (capturas y documentos) de solicitudes y comentarios.
-- El archivo vive en disco (UPLOADS_DIR del API); la tabla guarda solo metadatos.
CREATE TABLE `adjuntos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ticketId` INTEGER NOT NULL,
    `comentarioId` INTEGER NULL,
    `nombreOriginal` VARCHAR(255) NOT NULL,
    `nombreArchivo` VARCHAR(80) NOT NULL,
    `mimeType` VARCHAR(120) NOT NULL,
    `tamano` INTEGER NOT NULL,
    `usuarioId` INTEGER NULL,
    `empleadoRfc` VARCHAR(13) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `adjuntos_nombreArchivo_key`(`nombreArchivo`),
    INDEX `adjuntos_ticketId_idx`(`ticketId`),
    INDEX `adjuntos_comentarioId_idx`(`comentarioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `adjuntos` ADD CONSTRAINT `adjuntos_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `tickets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `adjuntos` ADD CONSTRAINT `adjuntos_comentarioId_fkey` FOREIGN KEY (`comentarioId`) REFERENCES `comentarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `adjuntos` ADD CONSTRAINT `adjuntos_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
