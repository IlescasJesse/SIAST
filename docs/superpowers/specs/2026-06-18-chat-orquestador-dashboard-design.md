# Chat orquestador en el dashboard — Diseño

**Fecha:** 2026-06-18
**Autor:** Jesse + Claude
**Estado:** Aprobado para planificación

## Problema

El `agent-dashboard.html` envía solicitudes vía `POST /api/orchestrator/action`, que
las escribe en `agent-status.json`. Pero **nada dispara la lectura de ese archivo**:
el "orquestador" es una sesión de Claude Code que sólo lee el buzón cuando un humano
se lo pide. Resultado: las solicitudes se acumulan sin atenderse (5 pendientes, la más
vieja de hace 5 horas). La comunicación no es directa: es un buzón que nadie abre.

## Objetivo

Convertir el campo de texto del dashboard en un **chat real con un orquestador
agéntico**: lo que Jesse escribe se ejecuta como `claude -p` headless en el repo,
con capacidad de editar código y lanzar subagentes. La respuesta y el progreso
aparecen en el dashboard por el mecanismo de polling existente.

## Alcance

- **Incluye:** endpoint `/chat`, servicio que spawnea `claude -p`, transcript en el
  status, render del chat en el dashboard, guard de acceso solo-local.
- **No incluye:** WebSocket nuevo, historial persistente entre reinicios del API,
  multi-sesión simultánea, autenticación por usuario (sigue el modelo token/local).

## Arquitectura

Reusa el patrón de polling actual — **no se introduce ningún canal nuevo**. El chat
escribe en el mismo `agent-status.json` que el dashboard ya lee cada 2.5 s.

```
Dashboard (ENVIAR) → POST /api/orchestrator/chat { message }
   → chat.service: spawn  claude -p --output-format stream-json --verbose
        cwd = REPO_ROOT,  --dangerously-skip-permissions
   → parsea eventos stream-json:
        · texto del asistente  → status.chat[]   (rol assistant)
        · eventos de progreso  → status.log[]     (panel TERMINAL OUTPUT)
   → al terminar: marca el job idle, respuesta final en status.chat[]
Dashboard → GET /status cada 2.5 s → render transcript + terminal
```

### Decisión: asíncrono, un job a la vez

`claude -p` agéntico tarda minutos. Una request HTTP síncrona colgaría el dashboard,
así que `/chat`:

1. Si ya hay un job corriendo → responde `409` (orquestador ocupado).
2. Si está libre → registra el mensaje del usuario en `status.chat[]`, spawnea el
   proceso, y responde `202` de inmediato con `{ jobId }`.
3. El progreso y la respuesta aparecen por el poll de `/status`.

Un solo job a la vez: no puede haber dos Claude editando el mismo repo en paralelo.

## Componentes

### 1. `apps/api/src/services/chat.service.ts` (nuevo)

Responsabilidad única: gestionar el ciclo de vida del job de chat.

- `startChat(message: string): { jobId } | { busy: true }` — valida que no haya job
  activo, registra el mensaje, spawnea `claude -p`.
- Parser de `stream-json`: por cada línea NDJSON, distingue eventos de tipo
  `assistant` (texto) de eventos de herramienta/sistema (progreso → log).
- Estado interno: `{ running: boolean, jobId, startedAt }`. Exportar `isBusy()`.
- Timeout duro (p. ej. 10 min) → mata el proceso y escribe error en chat + log.
- Escribe en `agent-status.json` mediante el mismo helper de lectura/escritura del
  controller (extraer `readStatus`/`writeStatus` a un módulo compartido si hace falta,
  para no duplicar). Serializa escrituras para evitar carreras con `/answer` y `/action`.

### 2. `apps/api/src/controllers/orchestrator.controller.ts`

- `postChat(req, res)` — valida `message` no vacío, delega en `chat.service`,
  responde `202 { jobId }` o `409 { error: "ocupado" }`.
- Extender `OrchestratorStatus` con `chat: ChatMessage[]`
  (`{ role: "user" | "assistant", text, ts }`), incluido en `EMPTY_STATUS` y en
  la respuesta de `getStatus`.
- Guard de acceso local: `postChat` rechaza con `403` si `req.get("cf-connecting-ip")`
  y `process.env.DASHBOARD_CHAT_REMOTE !== "true"`.

### 3. `apps/api/src/routes/orchestrator.routes.ts`

- `router.post("/chat", ctrl.postChat)`.

### 4. `agent-dashboard.html`

- Nueva área de **transcript del chat** (reusa estilo `.cmd-*` / panel existente).
- **ENVIAR** pasa de `/action` a `/chat`. Al enviar: pinta el mensaje del usuario
  optimista + placeholder "pensando…"; el poll de `fetchLive` rellena la respuesta
  desde `data.chat`.
- Manejo de `409` → aviso "orquestador ocupado, espera a que termine".
- `💾 GUARDAR` se mantiene en `/action` (sigue siendo un buzón de acción puntual).
- La cola de chips `commands` se conserva para `/action`; el chat es un panel aparte.

### 5. `apps/api/src/index.ts`

- Sin cambios estructurales. El guard de túnel ya restringe a `/api/orchestrator`;
  el guard solo-local de `/chat` vive en el controller (más granular).
- Documentar el flag `DASHBOARD_CHAT_REMOTE` en `.env.example`.

## Flujo de datos

1. Jesse escribe "arregla la tarjeta fantasma" → ENVIAR.
2. `POST /chat` → `chat.service` registra el mensaje en `status.chat[]`, spawnea
   `claude -p "arregla la tarjeta fantasma"` en el repo.
3. El proceso edita archivos, corre subagentes; cada evento de progreso se vuelca en
   `status.log[]`.
4. El dashboard, en su poll, muestra el progreso en TERMINAL OUTPUT y, al terminar,
   la respuesta final en el transcript.

## Manejo de errores

| Caso                       | Comportamiento                                       |
| -------------------------- | ---------------------------------------------------- |
| Job ya corriendo           | `409`; dashboard muestra "ocupado"                   |
| `claude` sale ≠ 0          | Mensaje de error en `status.chat[]` + `status.log[]` |
| Timeout (10 min)           | Mata el proceso, reporta en chat + log               |
| `/chat` vía túnel sin flag | `403` "chat no expuesto públicamente"                |
| `message` vacío            | `400`                                                |

## Seguridad (contexto gubernamental)

- `/chat` ejecuta `claude --dangerously-skip-permissions` en el repo = ejecución
  agéntica con permisos amplios. **Solo-local por defecto**: rechazado por túnel salvo
  `DASHBOARD_CHAT_REMOTE=true` explícito.
- Sin API key nueva: usa la auth existente de Claude Code (suscripción de Jesse).
- No se exponen datos fiscales por este canal; el guard de túnel de `index.ts` sigue
  bloqueando todo lo que no sea `/api/orchestrator`.

## Testing

- **Unit (`chat.service`):** parser de `stream-json` clasifica assistant vs progreso;
  `isBusy()` rechaza un segundo job; timeout mata el proceso.
- **Integración:** `POST /chat` con un binario `claude` stub → responde `202`,
  `status.chat[]` se puebla; segundo `POST` concurrente → `409`; request con
  `cf-connecting-ip` sin flag → `403`.
- **Manual:** `claude -p "di hola"` real desde el dashboard local.

## Notas de implementación

- Orden: servicio → controller → ruta → dashboard (modelo→backend→frontend).
- Extraer `readStatus`/`writeStatus` a un módulo compartido si el servicio y el
  controller los necesitan, para no duplicar la lógica de I/O del status.
- Serializar las escrituras a `agent-status.json` (cola/mutex simple) — ahora hay tres
  escritores: `/answer`, `/action`, `/chat`.
