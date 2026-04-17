-- Migration: 20260417000001_add_papeleria_recursos_adicionales
-- Descripción: Agrega PAPELERIA al enum subcategoria y columna recursosAdicionales al modelo Ticket

-- 1. Ampliar el enum subcategoria en la tabla tickets para incluir PAPELERIA
ALTER TABLE `tickets`
  MODIFY COLUMN `subcategoria`
  ENUM(
    'SISTEMAS',
    'SOPORTE_TECNICO',
    'IMPRESORAS',
    'REDES_INTERNET',
    'CONFIGURACION_CORREO_OUTLOOK',
    'SANITARIOS',
    'ILUMINACION',
    'MOVILIDAD',
    'SALA_JUNTAS',
    'EQUIPO_AUDIOVISUAL',
    'PRESTAMO_EQUIPO',
    'MOBILIARIO',
    'PAPELERIA'
  ) NOT NULL;

-- 2. Agregar columna recursosAdicionales (JSON serializado, opcional)
ALTER TABLE `tickets`
  ADD COLUMN `recursosAdicionales` TEXT NULL;
