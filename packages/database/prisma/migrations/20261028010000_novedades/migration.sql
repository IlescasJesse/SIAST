-- Novedades de versión lanzadas desde el monitor del servidor.
CREATE TABLE `novedades` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `version` VARCHAR(30) NULL,
    `titulo` VARCHAR(120) NOT NULL,
    `mensaje` TEXT NOT NULL,
    `puntos` JSON NOT NULL,
    `audiencia` ENUM('TODOS', 'EMPLEADOS', 'STAFF') NOT NULL DEFAULT 'TODOS',
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `novedades_activo_createdAt_idx`(`activo`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
