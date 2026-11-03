-- Áreas poligonales: 4 vértices [[col,fila],…] movibles uno por uno en el editor.
-- NULL = rectángulo gridX1..gridY2 (todas las áreas existentes quedan igual).
ALTER TABLE `areas_edificio` ADD COLUMN `vertices` JSON NULL;
