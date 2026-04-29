-- Limpia todos los tickets y datos relacionados
-- mysql -u root siast_db < clean_tickets.sql

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE `comentarios`;
TRUNCATE TABLE `pasos_ticket`;
TRUNCATE TABLE `historial_tickets`;
TRUNCATE TABLE `notificaciones`;
TRUNCATE TABLE `tickets`;

SET FOREIGN_KEY_CHECKS = 1;

ALTER TABLE `tickets` AUTO_INCREMENT = 1;
ALTER TABLE `comentarios` AUTO_INCREMENT = 1;
ALTER TABLE `pasos_ticket` AUTO_INCREMENT = 1;
ALTER TABLE `historial_tickets` AUTO_INCREMENT = 1;
ALTER TABLE `notificaciones` AUTO_INCREMENT = 1;
