-- AlterTable
ALTER TABLE `catalogo_recursos` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `unidades_recurso` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `usuarios` ADD COLUMN `area_soporte_id` INTEGER NULL,
    MODIFY `rol` ENUM('ADMIN', 'TECNICO_TI', 'TECNICO_REDES', 'TECNICO_SERVICIOS', 'MESA_AYUDA', 'GESTOR_RECURSOS_MATERIALES', 'EMPLEADO', 'RESPONSABLE_TI', 'RESPONSABLE_REDES', 'RESPONSABLE_MANTENIMIENTO', 'RESPONSABLE_RECURSOS_MATERIALES', 'TECNICO_ELECTRICISTA', 'TECNICO_PLOMERO', 'TECNICO_MOVILIDAD') NOT NULL;

-- CreateTable
CREATE TABLE `areas_soporte` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(50) NOT NULL,
    `subcategorias` JSON NOT NULL,
    `rolesIncluidos` JSON NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `areas_soporte_nombre_key`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `usuarios` ADD CONSTRAINT `usuarios_area_soporte_id_fkey` FOREIGN KEY (`area_soporte_id`) REFERENCES `areas_soporte`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
