SELECT
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='siast_db' AND TABLE_NAME='areas_edificio' AND COLUMN_NAME='esSalaJuntas') AS col_esSalaJuntas,
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='siast_db' AND TABLE_NAME='tickets' AND COLUMN_NAME='sub_tipo') AS col_sub_tipo,
  (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='siast_db' AND TABLE_NAME='pasos_ticket') AS tbl_pasos_ticket,
  (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='siast_db' AND TABLE_NAME='procesos_definicion') AS tbl_procesos_definicion,
  (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='siast_db' AND TABLE_NAME='pasos_definicion') AS tbl_pasos_definicion,
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='siast_db' AND TABLE_NAME='pasos_ticket' AND COLUMN_NAME='cantidad_unidades') AS col_cantidad_unidades;
