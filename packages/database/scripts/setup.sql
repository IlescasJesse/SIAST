-- Script de configuración inicial de MySQL para SIAST
-- Ejecutar como root: mysql -u root < scripts/setup.sql

CREATE DATABASE IF NOT EXISTS siast_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'siast_user'@'localhost' IDENTIFIED BY 'siast_pass';

GRANT ALL PRIVILEGES ON siast_db.* TO 'siast_user'@'localhost';

FLUSH PRIVILEGES;

SELECT 'Base de datos siast_db y usuario siast_user creados exitosamente.' AS resultado;
