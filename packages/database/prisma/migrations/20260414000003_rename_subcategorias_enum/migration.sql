-- Migrar valores existentes antes de cambiar el ENUM
-- REDES y INTERNET → REDES_INTERNET, IMPRESORAS_OTROS → IMPRESORAS
UPDATE `tickets` SET `subcategoria` = 'REDES_INTERNET'
  WHERE `subcategoria` IN ('REDES', 'INTERNET');

UPDATE `tickets` SET `subcategoria` = 'IMPRESORAS'
  WHERE `subcategoria` = 'IMPRESORAS_OTROS';

-- Redefinir el ENUM con los nuevos valores
ALTER TABLE `tickets`
  MODIFY COLUMN `subcategoria`
  ENUM('SISTEMAS', 'SOPORTE_TECNICO', 'IMPRESORAS', 'REDES_INTERNET', 'SANITARIOS', 'ILUMINACION', 'MOVILIDAD') NOT NULL;
