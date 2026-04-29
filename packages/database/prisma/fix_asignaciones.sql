-- Verificar si recursoId existe y eliminarlo con su FK
SET @fk_exists = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = 'siast_db'
    AND TABLE_NAME = 'asignaciones_recursos'
    AND CONSTRAINT_NAME = 'asignaciones_recursos_recursoId_fkey'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);

SET @sql = IF(@fk_exists > 0,
  'ALTER TABLE `asignaciones_recursos` DROP FOREIGN KEY `asignaciones_recursos_recursoId_fkey`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Eliminar columna recursoId si existe
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'siast_db'
    AND TABLE_NAME = 'asignaciones_recursos'
    AND COLUMN_NAME = 'recursoId'
);

SET @sql2 = IF(@col_exists > 0,
  'ALTER TABLE `asignaciones_recursos` DROP COLUMN `recursoId`',
  'SELECT 1'
);
PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;
