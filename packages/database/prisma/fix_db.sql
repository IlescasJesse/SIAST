-- Fix: aplicar migraciones pendientes de forma segura

-- 1. Agregar recursosAdicionales a tickets si no existe
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'siast_db'
    AND TABLE_NAME = 'tickets'
    AND COLUMN_NAME = 'recursosAdicionales'
);

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE `tickets` ADD COLUMN `recursosAdicionales` TEXT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Ampliar enum subcategoria (incluye PAPELERIA)
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
    'MOBILIARIO',
    'PAPELERIA'
  ) NOT NULL;

-- 3. Crear catalogo_recursos si no existe
CREATE TABLE IF NOT EXISTS `catalogo_recursos` (
  `id`          INTEGER NOT NULL AUTO_INCREMENT,
  `nombre`      VARCHAR(150) NOT NULL,
  `descripcion` TEXT NULL,
  `tipo`        ENUM('TECNOLOGICO', 'INMOBILIARIO') NOT NULL,
  `marca`       VARCHAR(100) NULL,
  `capacidad`   INTEGER NULL,
  `activo`      BOOLEAN NOT NULL DEFAULT true,
  `createdAt`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `catalogo_recursos_tipo_idx`(`tipo`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 4. Crear unidades_recurso si no existe
CREATE TABLE IF NOT EXISTS `unidades_recurso` (
  `id`          INTEGER NOT NULL AUTO_INCREMENT,
  `catalogoId`  INTEGER NOT NULL,
  `numSerie`    VARCHAR(100) NULL,
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

-- 5. Migrar datos de recursos -> catalogo_recursos + unidades_recurso (si recursos existe)
SET @recursos_exists = (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = 'siast_db' AND TABLE_NAME = 'recursos'
);

SET @sql2 = IF(@recursos_exists > 0,
  'INSERT IGNORE INTO `catalogo_recursos` (`id`,`nombre`,`descripcion`,`tipo`,`marca`,`capacidad`,`activo`,`createdAt`,`updatedAt`) SELECT `id`,`nombre`,`descripcion`,`tipo`,`marca`,`capacidad`,`activo`,`createdAt`,`updatedAt` FROM `recursos`',
  'SELECT 1'
);
PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

SET @sql3 = IF(@recursos_exists > 0,
  'INSERT IGNORE INTO `unidades_recurso` (`id`,`catalogoId`,`numSerie`,`piso`,`areaId`,`disponible`,`activo`,`createdAt`,`updatedAt`) SELECT `id`,`id`,`numSerie`,`piso`,`areaId`,`disponible`,`activo`,`createdAt`,`updatedAt` FROM `recursos`',
  'SELECT 1'
);
PREPARE stmt3 FROM @sql3;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;

-- 6. Agregar unidadId a asignaciones_recursos si no existe
SET @unidad_col = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'siast_db'
    AND TABLE_NAME = 'asignaciones_recursos'
    AND COLUMN_NAME = 'unidadId'
);

SET @sql4 = IF(@unidad_col = 0,
  'ALTER TABLE `asignaciones_recursos` ADD COLUMN `unidadId` INTEGER NULL',
  'SELECT 1'
);
PREPARE stmt4 FROM @sql4;
EXECUTE stmt4;
DEALLOCATE PREPARE stmt4;

-- 7. Llenar unidadId desde recursoId si recursoId existe y unidadId está vacío
SET @recursoId_col = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'siast_db'
    AND TABLE_NAME = 'asignaciones_recursos'
    AND COLUMN_NAME = 'recursoId'
);

SET @sql5 = IF(@recursoId_col > 0,
  'UPDATE `asignaciones_recursos` SET `unidadId` = `recursoId` WHERE `unidadId` IS NULL',
  'SELECT 1'
);
PREPARE stmt5 FROM @sql5;
EXECUTE stmt5;
DEALLOCATE PREPARE stmt5;
