-- Override manual de prioridad por Mesa de Ayuda / Responsable de área.
-- Si está definido, gana sobre el cálculo automático por antigüedad (computeAutoPriority en tickets.service.ts).
ALTER TABLE `tickets` ADD COLUMN `prioridad_manual` ENUM('BAJA', 'MEDIA', 'ALTA', 'URGENTE') NULL;
