-- Solicitudes resueltas directo por Admin / Mesa de Ayuda / Responsable quedaban sin
-- técnico y no contaban en métricas. Se asigna como técnico a quien la resolvió
-- (último registro RESUELTO del historial).
UPDATE `tickets` t
JOIN (
  SELECT h.`ticketId`, MAX(h.`id`) AS hid
  FROM `historial_tickets` h
  WHERE h.`estadoNuevo` = 'RESUELTO' AND h.`usuarioId` IS NOT NULL
  GROUP BY h.`ticketId`
) ult ON ult.`ticketId` = t.`id`
JOIN `historial_tickets` h2 ON h2.`id` = ult.hid
SET t.`tecnicoId` = h2.`usuarioId`,
    t.`fechaAsignacion` = COALESCE(t.`fechaAsignacion`, h2.`createdAt`)
WHERE t.`tecnicoId` IS NULL AND t.`estado` = 'RESUELTO';
