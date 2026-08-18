-- AlterTable
ALTER TABLE `tickets` ADD COLUMN `aceptado_en` DATETIME(3) NULL,
    ADD COLUMN `aceptado_por_id` INTEGER NULL,
    ADD COLUMN `categoria_original` ENUM('TECNOLOGIAS', 'SERVICIOS', 'RECURSOS_MATERIALES') NULL,
    ADD COLUMN `subcategoria_original` ENUM('SISTEMAS_INSTITUCIONALES', 'EQUIPOS_DISPOSITIVOS', 'RED_INTERNET', 'CUENTAS_DOMINIO', 'CORREO_OUTLOOK', 'SANITARIOS', 'ILUMINACION', 'MOVILIDAD', 'SALA_JUNTAS', 'EQUIPO_AUDIOVISUAL', 'PRESTAMO_EQUIPO', 'MOBILIARIO', 'PAPELERIA') NULL;

-- AlterTable
ALTER TABLE `usuarios` MODIFY `rol` ENUM('ADMIN', 'TECNICO_TI', 'TECNICO_REDES', 'TECNICO_SERVICIOS', 'MESA_AYUDA', 'GESTOR_RECURSOS_MATERIALES', 'EMPLEADO', 'RESPONSABLE_TI', 'RESPONSABLE_REDES', 'RESPONSABLE_MANTENIMIENTO', 'RESPONSABLE_RECURSOS_MATERIALES', 'TECNICO_ELECTRICISTA', 'TECNICO_PLOMERO', 'TECNICO_MOVILIDAD', 'GESTOR_SALAS_JUNTA', 'GESTOR_RECURSOS', 'GESTOR_INVENTARIO', 'RESPONSABLE_SISTEMAS', 'TECNICO_SISTEMAS') NOT NULL;

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_aceptado_por_id_fkey` FOREIGN KEY (`aceptado_por_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: snapshot de categoria/subcategoria original para tickets ya existentes
UPDATE `tickets` SET `categoria_original` = `categoria`, `subcategoria_original` = `subcategoria`
WHERE `categoria_original` IS NULL;

-- Backfill: tickets ya avanzados (asignados/en progreso/resueltos/cancelados) se marcan
-- como aceptados retroactivamente para no bloquear el flujo existente con el nuevo guard
-- de triage. Solo los tickets aún ABIERTO quedan pendientes de aceptación real.
UPDATE `tickets` SET `aceptado_en` = COALESCE(`fechaAsignacion`, `createdAt`)
WHERE `estado` != 'ABIERTO' AND `aceptado_en` IS NULL;
