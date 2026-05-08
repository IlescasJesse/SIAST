# Phase 2: Features Pendientes — Procesos y Flujos - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-08
**Phase:** 2-Features Pendientes — Procesos y Flujos
**Areas discussed:** Migración DB (PRO-01), Flujo SIRH/SIAST (PRO-02/03), Escalamiento RM (PRO-04), Socket.IO en nuevos flujos (NOT-01/02)

---

## Migración DB (PRO-01)

### ¿Cómo debe leer crearTicket el proceso al crear un ticket?

| Option | Description | Selected |
|--------|-------------|----------|
| Query DB directa | crearTicket consulta ProcesoDefinicion por (subcategoria, subTipo). DB es fuente de verdad. Admin edita → próximo ticket usa definición actualizada inmediatamente. | ✓ |
| Cache en memoria al startup | Cargar todos los ProcesoDefinicion al iniciar el API. Simple pero requiere restart para ver cambios. | |
| Mantener PROCESO_MAP + DB como override | Si DB tiene registro, usarlo. Si no, fallback a PROCESO_MAP. Dos fuentes de verdad. | |

**User's choice:** Query DB directa

---

### ¿Cómo manejar que el seed no popula ProcesoDefinicion?

| Option | Description | Selected |
|--------|-------------|----------|
| Seed DB con datos del PROCESO_MAP | Agregar seed para ProcesoDefinicion que replique todos los procesos actuales. Sin fallback. | ✓ |
| Migración SQL manual | Script SQL o migración Prisma que inserte los procesos. Más formal. | |
| Ticket sin pasos = válido | Si no hay proceso en DB, crear ticket sin pasos. Admin define después. | |

**User's choice:** Seed DB con datos del PROCESO_MAP

---

### ¿metricas.controller.ts migra también a DB?

| Option | Description | Selected |
|--------|-------------|----------|
| Sí, leer ProcesoDefinicion de DB | Consistencia total: una fuente de verdad. | ✓ |
| No, dejar PROCESO_MAP en métricas | Métricas es Phase 3. No tocar ahora. | |

**User's choice:** Sí

---

### ¿Qué hacemos con PROCESO_MAP después de migrar?

| Option | Description | Selected |
|--------|-------------|----------|
| Eliminar PROCESO_MAP | Una vez DB es fuente de verdad, eliminar para evitar confusión futura. | ✓ |
| Mantener como referencia | Dejar como documentación sin uso funcional. | |

**User's choice:** Eliminar PROCESO_MAP (+ getProcesoKey, getProcesoInfo)

---

## Flujo SIRH/SIAST (PRO-02/03)

### ¿Qué rol atiende SISTEMAS_INSTITUCIONALES:SIRH?

| Option | Description | Selected |
|--------|-------------|----------|
| TECNICO_TI | Rol existente, mismo pool que soporte de equipo. | ✓ |
| TECNICO_SERVICIOS | Si el personal de SIRH es de servicios. | |
| Tú decides | Agente elige según DB. | |

**User's choice:** TECNICO_TI

---

### ¿DIRECTO o SECUENCIAL para SIRH y SIAST?

| Option | Description | Selected |
|--------|-------------|----------|
| DIRECTO — 1 paso cada uno | Consistente con otros flujos de soporte directo. | ✓ |
| SECUENCIAL — diagnóstico + resolución | 2 pasos. Más granularidad. | |
| Diferente por sistema | SIRH y SIAST con pasos distintos entre sí. | |

**User's choice:** DIRECTO — 1 paso cada uno

---

### ¿Mismos flujo que TECNOLOGIAS?

| Option | Description | Selected |
|--------|-------------|----------|
| Mismo flujo que TECNOLOGIAS | crearTicket ya tiene if (categoriaVal === 'TECNOLOGIAS'). SISTEMAS_INSTITUCIONALES es subcategoría de TECNOLOGIAS. | ✓ |
| Requieren manejo propio | Algo especial que no encaja con el bloque existente. | |

**User's choice:** Mismo flujo que TECNOLOGIAS

---

### ¿Cómo se llaman los pasos de SIRH y SIAST?

| Option | Description | Selected |
|--------|-------------|----------|
| Genérico: 'Atención por Soporte TI' | Consistente con estilo del resto de procesos. Admin edita después. | ✓ |
| Específico: 'Soporte técnico SIRH' / 'Soporte técnico SIAST' | Más descriptivo para el técnico. | |
| Tú decides | Agente elige coherente con PROCESO_MAP existente. | |

**User's choice:** Genérico: 'Atención por Soporte TI'

---

## Escalamiento RM (PRO-04)

### ¿Cómo funciona mecánicamente el escalamiento RM?

| Option | Description | Selected |
|--------|-------------|----------|
| Nuevo paso en el ticket | Agrega PasoTicket con rol GESTOR_RECURSOS_MATERIALES. Mismo ticket, flujo extendido. | ✓ |
| Ticket nuevo de Recursos vinculado | Crea ticket separado en RECURSOS_MATERIALES con FK al original. | |
| AsignacionRecurso existente | Usar modelo AsignacionRecurso sin paso adicional. | |

**User's choice:** Nuevo paso en el ticket

---

### ¿Quién dispara el escalamiento?

| Option | Description | Selected |
|--------|-------------|----------|
| Endpoint explícito POST /tickets/:id/escalar-rm | Técnico llama endpoint cuando necesita pieza. | ✓ |
| Al completar paso TI con flag | Técnico completa su paso con requiere_pieza=true. | |
| Admin lo define en el proceso | MANTENIMIENTO_CORRECTIVO siempre tiene 2 pasos: TI + RM. | |

**User's choice:** Endpoint explícito POST /tickets/:id/escalar-rm

---

### ¿Qué pasa con el ticket después del escalamiento?

| Option | Description | Selected |
|--------|-------------|----------|
| Ticket sigue ASIGNADO/EN_PROGRESO hasta que gestor complete su paso | Flujo espera al gestor de RM. | ✓ |
| TI completa su paso, ticket espera solo al gestor | El paso de TI se marca completado. Solo espera RM. | |
| Tú decides | Agente define flujo consistente con state machine existente. | |

**User's choice:** Ticket sigue ASIGNADO/EN_PROGRESO hasta que RM complete

---

### ¿Solo MANTENIMIENTO_CORRECTIVO puede escalar?

| Option | Description | Selected |
|--------|-------------|----------|
| Solo MANTENIMIENTO_CORRECTIVO | Endpoint valida subcategoría + subTipo. Scope claro. | ✓ |
| Cualquier ticket puede escalar | Más flexible, pero fuera de scope de Phase 2. | |
| Tú decides | Agente valida según modelo de datos. | |

**User's choice:** Solo MANTENIMIENTO_CORRECTIVO

---

## Socket.IO en nuevos flujos (NOT-01/02)

### ¿Cuándo ocurre la asignación de técnico en SIRH/SIAST?

| Option | Description | Selected |
|--------|-------------|----------|
| Manual: admin/mesa_ayuda asigna el paso | Igual que hoy. Paso se crea PENDIENTE, admin asigna técnico. | ✓ |
| Auto-asignar al primer TECNICO_TI disponible | Al crear ticket, buscar técnico con menos carga. | |
| Tú decides | Agente elige según patrón existente. | |

**User's choice:** Manual — igual que el flujo existente

---

### ¿Qué evento Socket.IO emitir al escalar a RM?

| Option | Description | Selected |
|--------|-------------|----------|
| ticket:paso_listo a admins | Indica 'hay un paso que necesita asignación'. Consistente con patrón existente. | ✓ |
| ticket:paso_asignado al gestor | Si hay gestor asignado en el endpoint. | |
| Evento nuevo ticket:escalado_rm | Requiere cambios en frontend para escuchar. | |

**User's choice:** ticket:paso_listo a admins

---

### NOT-02: ¿Qué se registra en historialTicket cuando gestor completa paso de RM?

| Option | Description | Selected |
|--------|-------------|----------|
| Comentario genérico: 'Recurso asignado por gestor' | Consistente con estilo actual. | ✓ |
| Comentario con detalle del recurso asignado | Nombre o cantidad del recurso. Más informativo. | |
| Tú decides | Agente elige formato consistente con historialTicket existente. | |

**User's choice:** Comentario genérico: 'Recurso asignado por gestor'

---

## Claude's Discretion

- Orden de validaciones en endpoint `escalar-rm`
- Si ya existe paso PENDIENTE de `GESTOR_RECURSOS_MATERIALES`, rechazar con 409 (escalamiento duplicado)
- Nombre exacto del paso de RM en seed para MANTENIMIENTO_CORRECTIVO

## Deferred Ideas

- **Panel UI admin para CRUD de procesos:** API existe pero no hay frontend. Fase Admin avanzado.
- **Auto-asignación de técnico:** Buscar técnico con menos carga al crear ticket. Fuera de scope Phase 2.
