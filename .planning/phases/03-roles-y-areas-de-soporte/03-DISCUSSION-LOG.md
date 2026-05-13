# Phase 3: Roles y Áreas de Soporte — Discussion Log

**Date:** 2026-05-13
**Duration:** ~1 sesión

---

## Context Discovery

El usuario originalmente inició `/gsd-discuss-phase 3` para "Métricas Operacionales". Durante la discusión, al explorar "métricas por área", se descubrió que el usuario tenía en mente una reorganización completa del sistema de roles para reflejar la estructura real de soporte técnico (TI, REDES, MANTENIMIENTO, RECURSOS MATERIALES).

**Pivot de scope:** El contenido original de Phase 3 (Métricas) se movió a Phase 4. Se insertó nueva Phase 3 = "Roles y Áreas de Soporte".

---

## Gray Areas Discutidas

### 1. Página /metricas vs Dashboard
- **Presentado:** Página nueva `/metricas` vs sección en DashboardPage existente
- **Selección:** Sección en DashboardPage existente
- **Nota:** Esta decisión aplica a Phase 4 (Métricas), no a Phase 3

### 2. Endpoint /api/metricas/area
- **Clarificación del usuario:** "Área" = área de soporte funcional (TI, REDES, etc.), NO `AreaEdificio` del edificio. El usuario quería métricas por área de soporte con visibilidad por rol.
- **Resultado:** Descubrimiento del pivot de scope — requiere nueva fase de roles primero

### 3. Rol "responsable de área"
- **Pregunta:** ¿Existe o hay que crearlo?
- **Selección:** Crear rol nuevo `JEFE_AREA` → refinado a 4 roles `RESPONSABLE_*` específicos por área

### 4. Mapeo áreas → DB
- **Pregunta:** ¿Por rol, subcategoría, o entidad nueva?
- **Selección:** Crear entidad `AreaSoporte` nueva en DB

### 5. TECNICO_SERVICIOS
- **Pregunta:** ¿Reemplazar o mantener?
- **Selección:** Reemplazar por 3 roles específicos (TECNICO_ELECTRICISTA, TECNICO_PLOMERO, TECNICO_MOVILIDAD)
- **Migración:** Admin reasigna manualmente — sin script automático

### 6. Permisos RESPONSABLE_*
- **Selección (multiselect):** Reasignar solicitudes entre técnicos de su área + Cerrar/cancelar solicitudes de su área + Ver métricas de su área

### 7. Organización de fases
- **Pregunta:** ¿Insertar fase nueva, métricas simples ahora o todo junto?
- **Selección:** Insertar fase nueva "Roles y Áreas de Soporte" primero. Métricas pasa a Phase 4.

### 8. AreaSoporte DB design
- **Selección:** Simple — nombre + roles asignados + subcategorías mapeadas (Json en MySQL)
- **Campo en Usuario:** `areaSoporteId?` para vincular RESPONSABLE_* a su área

### 9. Migración TECNICO_SERVICIOS
- **Selección:** Admin reasigna manualmente desde el panel (sin migración automática)

---

## Mapeo Inferido (presentado al usuario, no contradicho)

```
TI:                  SISTEMAS_INSTITUCIONALES, EQUIPOS_DISPOSITIVOS, CUENTAS_DOMINIO, CORREO_OUTLOOK
REDES:               RED_INTERNET
MANTENIMIENTO:       SANITARIOS (plomero), ILUMINACION (electricista), MOVILIDAD
RECURSOS_MATERIALES: SALA_JUNTAS, EQUIPO_AUDIOVISUAL, PRESTAMO_EQUIPO, MOBILIARIO, PAPELERIA
```

---

## Deferred Ideas

- TECNICO_ALMACEN para RECURSOS_MATERIALES: mencionado pero no confirmado
- Room Socket.IO dedicada para RESPONSABLE_*: deferido a Phase 4
- RESPONSABLE_* como creador de tickets: fuera de scope (es rol de MESA_AYUDA)
