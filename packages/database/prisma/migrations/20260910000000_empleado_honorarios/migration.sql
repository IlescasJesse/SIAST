-- Personal por honorarios (invitado) registrado manualmente, no proviene del SIRH
-- (feedback staff P4-12, 2026-09-10)
ALTER TABLE `empleados`
  ADD COLUMN `esHonorarios` BOOLEAN NOT NULL DEFAULT false;
