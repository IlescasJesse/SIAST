-- ============================================================
-- Migración: add_recursos_materiales
-- Fecha: 2026-04-15
-- Descripción: Agrega módulo de Recursos Materiales al sistema
--   - Nuevo rol GESTOR_RECURSOS_MATERIALES
--   - Nueva categoría RECURSOS_MATERIALES
--   - Nuevas subcategorías: CONFIGURACION_CORREO_OUTLOOK, SALA_JUNTAS,
--     EQUIPO_AUDIOVISUAL, PRESTAMO_EQUIPO, MOBILIARIO
--   - Nuevas tablas: recursos, asignaciones_recursos
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. Modificar ENUM Rol en tabla usuarios
--    (incluye todos los valores existentes + GESTOR_RECURSOS_MATERIALES)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE `usuarios`
  MODIFY COLUMN `rol`
  ENUM('ADMIN', 'TECNICO_INFORMATICO', 'TECNICO_SERVICIOS', 'MESA_AYUDA', 'GESTOR_RECURSOS_MATERIALES', 'EMPLEADO') NOT NULL;

-- ──────────────────────────────────────────────────────────────
-- 2. Modificar ENUM categoria en tabla tickets
--    (incluye todos los valores existentes + RECURSOS_MATERIALES)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE `tickets`
  MODIFY COLUMN `categoria`
  ENUM('TECNOLOGIAS', 'SERVICIOS', 'RECURSOS_MATERIALES') NOT NULL;

-- ──────────────────────────────────────────────────────────────
-- 3. Modificar ENUM subcategoria en tabla tickets
--    (incluye todos los valores existentes + los 5 nuevos)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE `tickets`
  MODIFY COLUMN `subcategoria`
  ENUM(
    'SISTEMAS',
    'SOPORTE_TECNICO',
    'IMPRESORAS',
    'REDES_INTERNET',
    'CONFIGURACION_CORREO_OUTLOOK',
    'SANITARIOS',
    'ILUMINACION',
    'MOVILIDAD',
    'SALA_JUNTAS',
    'EQUIPO_AUDIOVISUAL',
    'PRESTAMO_EQUIPO',
    'MOBILIARIO'
  ) NOT NULL;

-- ──────────────────────────────────────────────────────────────
-- 4. Crear tabla recursos
-- ──────────────────────────────────────────────────────────────
CREATE TABLE `recursos` (
    `id`          INTEGER NOT NULL AUTO_INCREMENT,
    `nombre`      VARCHAR(150) NOT NULL,
    `descripcion` TEXT NULL,
    `tipo`        ENUM('TECNOLOGICO', 'INMOBILIARIO') NOT NULL,
    `numSerie`    VARCHAR(100) NULL,
    `marca`       VARCHAR(100) NULL,
    `capacidad`   INTEGER NULL,
    `piso`        ENUM('PB', 'NIVEL_1', 'NIVEL_2', 'NIVEL_3') NULL,
    `areaId`      VARCHAR(100) NULL,
    `disponible`  BOOLEAN NOT NULL DEFAULT true,
    `activo`      BOOLEAN NOT NULL DEFAULT true,
    `createdAt`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`   DATETIME(3) NOT NULL,

    INDEX `recursos_tipo_idx`(`tipo`),
    INDEX `recursos_disponible_activo_idx`(`disponible`, `activo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────────────────────
-- 5. Crear tabla asignaciones_recursos
-- ──────────────────────────────────────────────────────────────
CREATE TABLE `asignaciones_recursos` (
    `id`               INTEGER NOT NULL AUTO_INCREMENT,
    `recursoId`        INTEGER NOT NULL,
    `ticketId`         INTEGER NULL,
    `empleadoRfc`      VARCHAR(13) NULL,
    `gestorId`         INTEGER NULL,
    `fechaInicio`      DATETIME(3) NULL,
    `fechaFin`         DATETIME(3) NULL,
    `saleDEdificio`    BOOLEAN NOT NULL DEFAULT false,
    `propositoSalida`  VARCHAR(300) NULL,
    `ordenSalidaFolio` VARCHAR(50) NULL,
    `estado`           ENUM('PENDIENTE', 'APROBADA', 'RECHAZADA', 'DEVUELTA') NOT NULL DEFAULT 'PENDIENTE',
    `comentario`       TEXT NULL,
    `createdAt`        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`        DATETIME(3) NOT NULL,

    INDEX `asignaciones_recursos_recursoId_idx`(`recursoId`),
    INDEX `asignaciones_recursos_ticketId_idx`(`ticketId`),
    INDEX `asignaciones_recursos_empleadoRfc_idx`(`empleadoRfc`),
    INDEX `asignaciones_recursos_estado_idx`(`estado`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────────────────────
-- 6. Agregar Foreign Keys a asignaciones_recursos
-- ──────────────────────────────────────────────────────────────
ALTER TABLE `asignaciones_recursos`
  ADD CONSTRAINT `asignaciones_recursos_recursoId_fkey`
  FOREIGN KEY (`recursoId`) REFERENCES `recursos`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `asignaciones_recursos`
  ADD CONSTRAINT `asignaciones_recursos_ticketId_fkey`
  FOREIGN KEY (`ticketId`) REFERENCES `tickets`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `asignaciones_recursos`
  ADD CONSTRAINT `asignaciones_recursos_empleadoRfc_fkey`
  FOREIGN KEY (`empleadoRfc`) REFERENCES `empleados`(`rfc`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `asignaciones_recursos`
  ADD CONSTRAINT `asignaciones_recursos_gestorId_fkey`
  FOREIGN KEY (`gestorId`) REFERENCES `usuarios`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
