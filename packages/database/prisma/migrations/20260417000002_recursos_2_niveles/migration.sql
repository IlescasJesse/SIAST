-- ============================================================
-- Migración: restructure_recursos_catalogo_unidades
-- Fecha: 2026-04-17
-- Descripción: Divide Recurso en CatalogoRecurso + RecursoUnidad.
--   - Crea tabla catalogo_recursos
--   - Crea tabla unidades_recurso
--   - Migra datos existentes de recursos
--   - Actualiza asignaciones_recursos para usar unidadId
--   - Renombra tabla recursos a recursos_legacy (backup)
-- ============================================================

-- 1. Crear tabla catalogo_recursos
CREATE TABLE `catalogo_recursos` (
  `id`          INTEGER NOT NULL AUTO_INCREMENT,
  `nombre`      VARCHAR(150) NOT NULL,
  `descripcion` TEXT NULL,
  `tipo`        ENUM('TECNOLOGICO', 'INMOBILIARIO') NOT NULL,
  `marca`       VARCHAR(100) NULL,
  `capacidad`   INTEGER NULL,
  -- SICIPO - pendiente: `codigoSicipo` VARCHAR(50) NULL,
  `activo`      BOOLEAN NOT NULL DEFAULT true,
  `createdAt`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `catalogo_recursos_tipo_idx`(`tipo`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Crear tabla unidades_recurso
CREATE TABLE `unidades_recurso` (
  `id`          INTEGER NOT NULL AUTO_INCREMENT,
  `catalogoId`  INTEGER NOT NULL,
  `numSerie`    VARCHAR(100) NULL,
  -- SICIPO - pendiente: `codigoInventario` VARCHAR(100) NULL,
  `piso`        ENUM('PB', 'NIVEL_1', 'NIVEL_2', 'NIVEL_3') NULL,
  `areaId`      VARCHAR(100) NULL,
  `disponible`  BOOLEAN NOT NULL DEFAULT true,
  `activo`      BOOLEAN NOT NULL DEFAULT true,
  `createdAt`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `unidades_recurso_catalogoId_idx`(`catalogoId`),
  INDEX `unidades_recurso_disponible_activo_idx`(`disponible`, `activo`),
  PRIMARY KEY (`id`),
  CONSTRAINT `unidades_recurso_catalogoId_fkey`
    FOREIGN KEY (`catalogoId`) REFERENCES `catalogo_recursos`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 3. Migrar catálogos desde recursos (conservar IDs para facilitar migración de FKs)
INSERT INTO `catalogo_recursos` (`id`, `nombre`, `descripcion`, `tipo`, `marca`, `capacidad`, `activo`, `createdAt`, `updatedAt`)
SELECT `id`, `nombre`, `descripcion`, `tipo`, `marca`, `capacidad`, `activo`, `createdAt`, `updatedAt`
FROM `recursos`;

-- 4. Migrar unidades desde recursos (mismos IDs — 1 recurso = 1 unidad)
INSERT INTO `unidades_recurso` (`id`, `catalogoId`, `numSerie`, `piso`, `areaId`, `disponible`, `activo`, `createdAt`, `updatedAt`)
SELECT `id`, `id`, `numSerie`, `piso`, `areaId`, `disponible`, `activo`, `createdAt`, `updatedAt`
FROM `recursos`;

-- 5. Agregar columna unidadId a asignaciones_recursos (nullable primero)
ALTER TABLE `asignaciones_recursos` ADD COLUMN `unidadId` INTEGER NULL;

-- 6. Llenar unidadId = recursoId (IDs son idénticos gracias al paso 4)
UPDATE `asignaciones_recursos` SET `unidadId` = `recursoId`;

-- 7. Hacer unidadId NOT NULL y agregar FK
ALTER TABLE `asignaciones_recursos` MODIFY COLUMN `unidadId` INTEGER NOT NULL;
ALTER TABLE `asignaciones_recursos`
  ADD CONSTRAINT `asignaciones_recursos_unidadId_fkey`
  FOREIGN KEY (`unidadId`) REFERENCES `unidades_recurso`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 8. Eliminar FK y columna recursoId antigua
ALTER TABLE `asignaciones_recursos`
  DROP FOREIGN KEY `asignaciones_recursos_recursoId_fkey`;
ALTER TABLE `asignaciones_recursos` DROP COLUMN `recursoId`;

-- 9. Renombrar tabla original como backup
RENAME TABLE `recursos` TO `recursos_legacy`;
