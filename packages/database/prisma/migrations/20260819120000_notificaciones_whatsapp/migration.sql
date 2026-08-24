-- Opt-in de notificaciones de solicitudes por WhatsApp (feedback staff 2026-08-19).
ALTER TABLE `empleados` ADD COLUMN `notificacionesWhatsapp` BOOLEAN NOT NULL DEFAULT false;
