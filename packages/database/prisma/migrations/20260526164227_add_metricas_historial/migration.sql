-- AlterTable
ALTER TABLE `catalogo_recursos` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `unidades_recurso` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- CreateTable
CREATE TABLE `metricas_historial` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fecha` DATE NOT NULL,
    `area_soporte_id` INTEGER NULL,
    `total_tickets` INTEGER NOT NULL,
    `tickets_resueltos` INTEGER NOT NULL,
    `tickets_activos` INTEGER NOT NULL,
    `sla_global` DOUBLE NOT NULL,
    `tiempo_promedio_horas` DOUBLE NULL,
    `extras` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `metricas_historial_fecha_idx`(`fecha`),
    UNIQUE INDEX `metricas_historial_fecha_area_soporte_id_key`(`fecha`, `area_soporte_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
