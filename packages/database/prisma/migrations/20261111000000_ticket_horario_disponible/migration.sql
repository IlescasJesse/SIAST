-- Horario en que se puede encontrar al solicitante en su área (opcional, "HH:mm").
ALTER TABLE `tickets`
    ADD COLUMN `disponible_desde` VARCHAR(5) NULL,
    ADD COLUMN `disponible_hasta` VARCHAR(5) NULL;
