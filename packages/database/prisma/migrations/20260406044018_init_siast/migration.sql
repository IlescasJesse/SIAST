-- CreateTable
CREATE TABLE `usuarios` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(100) NOT NULL,
    `apellidos` VARCHAR(150) NOT NULL,
    `usuario` VARCHAR(50) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `email` VARCHAR(200) NULL,
    `telefono` VARCHAR(20) NULL,
    `rol` ENUM('ADMIN', 'TECNICO_INFORMATICO', 'TECNICO_SERVICIOS', 'MESA_AYUDA', 'EMPLEADO') NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `usuarios_usuario_key`(`usuario`),
    INDEX `usuarios_rol_idx`(`rol`),
    INDEX `usuarios_activo_idx`(`activo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `empleados` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rfc` VARCHAR(13) NOT NULL,
    `nombre` VARCHAR(100) NOT NULL,
    `apellidos` VARCHAR(150) NOT NULL,
    `nombreCompleto` VARCHAR(255) NOT NULL,
    `email` VARCHAR(200) NULL,
    `departamento` VARCHAR(150) NULL,
    `puesto` VARCHAR(150) NULL,
    `areaId` VARCHAR(100) NOT NULL,
    `piso` ENUM('PB', 'NIVEL_1', 'NIVEL_2', 'NIVEL_3') NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `sincronizadoSIRH` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `empleados_rfc_key`(`rfc`),
    INDEX `empleados_rfc_idx`(`rfc`),
    INDEX `empleados_areaId_idx`(`areaId`),
    INDEX `empleados_piso_idx`(`piso`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `areas_edificio` (
    `id` VARCHAR(100) NOT NULL,
    `label` VARCHAR(200) NOT NULL,
    `piso` ENUM('PB', 'NIVEL_1', 'NIVEL_2', 'NIVEL_3') NOT NULL,
    `floor` INTEGER NOT NULL,
    `gridX1` INTEGER NULL,
    `gridY1` INTEGER NULL,
    `gridX2` INTEGER NULL,
    `gridY2` INTEGER NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    INDEX `areas_edificio_piso_idx`(`piso`),
    INDEX `areas_edificio_floor_idx`(`floor`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tickets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `asunto` VARCHAR(100) NOT NULL,
    `descripcion` TEXT NOT NULL,
    `categoria` ENUM('TECNOLOGIAS', 'SERVICIOS') NOT NULL,
    `subcategoria` ENUM('SISTEMAS', 'SOPORTE_TECNICO', 'REDES', 'INTERNET', 'IMPRESORAS_OTROS', 'SANITARIOS', 'ILUMINACION', 'MOVILIDAD') NOT NULL,
    `estado` ENUM('ABIERTO', 'ASIGNADO', 'EN_PROGRESO', 'RESUELTO', 'CANCELADO') NOT NULL DEFAULT 'ABIERTO',
    `prioridad` ENUM('BAJA', 'MEDIA', 'ALTA', 'URGENTE') NOT NULL DEFAULT 'MEDIA',
    `empleadoRfc` VARCHAR(13) NOT NULL,
    `areaId` VARCHAR(100) NOT NULL,
    `piso` ENUM('PB', 'NIVEL_1', 'NIVEL_2', 'NIVEL_3') NOT NULL,
    `creadoPorId` INTEGER NULL,
    `tecnicoId` INTEGER NULL,
    `fechaAsignacion` DATETIME(3) NULL,
    `fechaInicio` DATETIME(3) NULL,
    `fechaResolucion` DATETIME(3) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `tickets_estado_idx`(`estado`),
    INDEX `tickets_empleadoRfc_idx`(`empleadoRfc`),
    INDEX `tickets_tecnicoId_idx`(`tecnicoId`),
    INDEX `tickets_categoria_idx`(`categoria`),
    INDEX `tickets_piso_idx`(`piso`),
    INDEX `tickets_createdAt_idx`(`createdAt`),
    INDEX `tickets_activo_idx`(`activo`),
    INDEX `tickets_empleadoRfc_estado_activo_idx`(`empleadoRfc`, `estado`, `activo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `historial_tickets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ticketId` INTEGER NOT NULL,
    `estadoAnterior` ENUM('ABIERTO', 'ASIGNADO', 'EN_PROGRESO', 'RESUELTO', 'CANCELADO') NULL,
    `estadoNuevo` ENUM('ABIERTO', 'ASIGNADO', 'EN_PROGRESO', 'RESUELTO', 'CANCELADO') NOT NULL,
    `usuarioId` INTEGER NULL,
    `empleadoRfc` VARCHAR(13) NULL,
    `comentario` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `historial_tickets_ticketId_idx`(`ticketId`),
    INDEX `historial_tickets_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `comentarios` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ticketId` INTEGER NOT NULL,
    `texto` TEXT NOT NULL,
    `esInterno` BOOLEAN NOT NULL DEFAULT false,
    `usuarioId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `comentarios_ticketId_idx`(`ticketId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notificaciones` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tipo` ENUM('TICKET_CREADO', 'TICKET_ASIGNADO', 'TICKET_ACTUALIZADO', 'TICKET_RESUELTO', 'TICKET_CANCELADO', 'TICKET_URGENTE') NOT NULL,
    `titulo` VARCHAR(200) NOT NULL,
    `mensaje` TEXT NOT NULL,
    `leida` BOOLEAN NOT NULL DEFAULT false,
    `usuarioId` INTEGER NULL,
    `empleadoRfc` VARCHAR(13) NULL,
    `ticketId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notificaciones_usuarioId_leida_idx`(`usuarioId`, `leida`),
    INDEX `notificaciones_empleadoRfc_leida_idx`(`empleadoRfc`, `leida`),
    INDEX `notificaciones_ticketId_idx`(`ticketId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `empleados` ADD CONSTRAINT `empleados_areaId_fkey` FOREIGN KEY (`areaId`) REFERENCES `areas_edificio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_empleadoRfc_fkey` FOREIGN KEY (`empleadoRfc`) REFERENCES `empleados`(`rfc`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_areaId_fkey` FOREIGN KEY (`areaId`) REFERENCES `areas_edificio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_creadoPorId_fkey` FOREIGN KEY (`creadoPorId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_tecnicoId_fkey` FOREIGN KEY (`tecnicoId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historial_tickets` ADD CONSTRAINT `historial_tickets_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `tickets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historial_tickets` ADD CONSTRAINT `historial_tickets_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comentarios` ADD CONSTRAINT `comentarios_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `tickets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comentarios` ADD CONSTRAINT `comentarios_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notificaciones` ADD CONSTRAINT `notificaciones_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notificaciones` ADD CONSTRAINT `notificaciones_empleadoRfc_fkey` FOREIGN KEY (`empleadoRfc`) REFERENCES `empleados`(`rfc`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notificaciones` ADD CONSTRAINT `notificaciones_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `tickets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
