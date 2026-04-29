SELECT
  (SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='siast_db' AND TABLE_NAME='usuarios' AND COLUMN_NAME='rol') AS enum_rol,
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='siast_db' AND TABLE_NAME='tickets' AND COLUMN_NAME='sub_tipo') AS col_sub_tipo,
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='siast_db' AND TABLE_NAME='tickets' AND COLUMN_NAME='recursosAdicionales') AS col_recursosAdicionales,
  (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='siast_db' AND TABLE_NAME='pasos_ticket') AS tbl_pasos_ticket;
