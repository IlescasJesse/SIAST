# Chat orquestador en el dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el campo de texto del `agent-dashboard.html` en un chat real con un orquestador agéntico que ejecuta `claude -p` headless en el repo.

**Architecture:** El dashboard hace `POST /api/orchestrator/chat`; un servicio spawnea `claude -p --output-format stream-json` (prompt por stdin), parsea los eventos NDJSON y vuelca la respuesta y el progreso al mismo `agent-status.json` que el dashboard ya consulta cada 2.5 s. Un job a la vez, asíncrono, solo-local por defecto.

**Tech Stack:** Express 5 + TypeScript (ESM), `node:child_process`, vitest (nuevo), HTML/JS vanilla en el dashboard.

## Global Constraints

- TypeScript ESM: imports con extensión `.js` (ej. `import x from "./y.js"`).
- Prettier: `semi: true`, `singleQuote: false`, `trailingComma: "all"`, `printWidth: 100`.
- El prompt del usuario NUNCA va en la línea de comandos — siempre por `stdin`. Los args de `claude` son literales estáticos.
- `/chat` es solo-local salvo `DASHBOARD_CHAT_REMOTE=true`: rechaza con `403` si llega `cf-connecting-ip` y el flag no está activo.
- Un solo job de chat a la vez (no dos Claude editando el repo en paralelo).
- Escrituras a `agent-status.json` serializadas entre `/answer`, `/action` y `/chat`.

---

## File Structure

- `apps/api/src/services/status.service.ts` (nuevo) — I/O compartido de `agent-status.json` (`readStatus`, `writeStatus` con mutex, tipos). Hoy esa lógica vive privada en el controller; se extrae para que el chat.service y el controller la compartan.
- `apps/api/src/services/chat.service.ts` (nuevo) — ciclo de vida del job: `parseStreamEvent` (puro, testeable), `isBusy`, `startChat` (spawn).
- `apps/api/src/services/chat.service.test.ts` (nuevo) — tests del parser y del guard de ocupado.
- `apps/api/src/controllers/orchestrator.controller.ts` (modificar) — `postChat`; usar `status.service`; extender el tipo de status con `chat[]`.
- `apps/api/src/routes/orchestrator.routes.ts` (modificar) — `POST /chat`.
- `apps/api/package.json` (modificar) — devDep `vitest` + script `test`.
- `apps/api/vitest.config.ts` (nuevo) — config mínima.
- `agent-dashboard.html` (modificar) — panel de transcript; `ENVIAR` → `/chat`.
- `.env.example` (modificar si existe) — documentar `DASHBOARD_CHAT_REMOTE`.

---

## Task 1: Setup de vitest

**Files:**

- Modify: `apps/api/package.json:6-11` (scripts), `:29-38` (devDependencies)
- Create: `apps/api/vitest.config.ts`

**Interfaces:**

- Produces: comando `npm test -w @stf/api` que corre `*.test.ts` con vitest.

- [ ] **Step 1: Añadir vitest a devDependencies y script test**

En `apps/api/package.json`, dentro de `"scripts"` añadir:

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

En `"devDependencies"` añadir:

```json
    "vitest": "^2.1.8"
```

- [ ] **Step 2: Crear vitest.config.ts**

Crear `apps/api/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Instalar**

Run: `npm install` (desde la raíz del monorepo)
Expected: vitest queda en `node_modules`, sin errores.

- [ ] **Step 4: Verificar que el runner arranca**

Run: `npm test -w @stf/api`
Expected: vitest corre y reporta "No test files found" (aún no hay tests). Sin crash.

- [ ] **Step 5: Commit**

```bash
git add apps/api/package.json apps/api/vitest.config.ts package-lock.json
git commit -m "chore(api): añade vitest para tests del orquestador"
```

---

## Task 2: status.service — I/O compartido con mutex

**Files:**

- Create: `apps/api/src/services/status.service.ts`
- Create: `apps/api/src/services/status.service.test.ts`

**Interfaces:**

- Produces:
  - `interface ChatMessage { role: "user" | "assistant"; text: string; ts: string }`
  - `interface OrchestratorStatus { updatedAt: string | null; mission: string; tasks: unknown[]; log: unknown[]; questions: OrchestratorQuestion[]; commands?: OrchestratorCommand[]; chat?: ChatMessage[] }`
  - `interface OrchestratorQuestion { id: string; agent: string; text: string; options?: string[]; answer?: string | null; answeredAt?: string | null }`
  - `interface OrchestratorCommand { id: string; label: string; action: string; ts: string; done?: boolean }`
  - `const EMPTY_STATUS: OrchestratorStatus`
  - `function readStatus(): Promise<OrchestratorStatus>`
  - `function writeStatus(status: OrchestratorStatus): Promise<void>` — serializa escrituras concurrentes (mutex por cadena de promesas).
  - `function STATUS_FILE_PATH(): string` (para tests apuntar a temp).

- [ ] **Step 1: Escribir el test de serialización del mutex**

Crear `apps/api/src/services/status.service.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import os from "os";
import path from "path";
import fs from "fs/promises";

// El módulo lee SIAST_ROOT al importar; lo fijamos a un tmp antes de importar.
let mod: typeof import("./status.service.js");
let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "siast-status-"));
  process.env.SIAST_ROOT = tmpRoot;
  mod = await import(`./status.service.js?t=${Date.now()}`);
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe("status.service", () => {
  it("readStatus devuelve EMPTY_STATUS cuando no hay archivo", async () => {
    const s = await mod.readStatus();
    expect(s.tasks).toEqual([]);
    expect(s.chat).toEqual([]);
  });

  it("writeStatus concurrente no pierde escrituras (mutex serializa)", async () => {
    // 10 escrituras concurrentes que leen-modifican-escriben deben todas persistir
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        (async () => {
          const s = await mod.readStatus();
          s.chat = [...(s.chat ?? []), { role: "user", text: `m${i}`, ts: "t" }];
          await mod.writeStatus(s);
        })(),
      ),
    );
    const final = await mod.readStatus();
    expect(final.chat).toHaveLength(10);
  });
});
```

- [ ] **Step 2: Correr el test → falla (módulo no existe)**

Run: `npm test -w @stf/api`
Expected: FAIL — no encuentra `./status.service.js`.

- [ ] **Step 3: Implementar status.service.ts**

Crear `apps/api/src/services/status.service.ts`:

```typescript
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// apps/api/src/services → ../../../../
const REPO_ROOT = process.env.SIAST_ROOT ?? path.resolve(__dirname, "../../../..");
const STATUS_FILE = path.join(REPO_ROOT, "agent-status.json");

export const STATUS_FILE_PATH = (): string => STATUS_FILE;

export interface OrchestratorQuestion {
  id: string;
  agent: string;
  text: string;
  options?: string[];
  answer?: string | null;
  answeredAt?: string | null;
}

export interface OrchestratorCommand {
  id: string;
  label: string;
  action: string;
  ts: string;
  done?: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  ts: string;
}

export interface OrchestratorStatus {
  updatedAt: string | null;
  mission: string;
  tasks: unknown[];
  log: unknown[];
  questions: OrchestratorQuestion[];
  commands?: OrchestratorCommand[];
  chat?: ChatMessage[];
}

export const EMPTY_STATUS: OrchestratorStatus = {
  updatedAt: null,
  mission: "",
  tasks: [],
  log: [],
  questions: [],
  commands: [],
  chat: [],
};

export async function readStatus(): Promise<OrchestratorStatus> {
  try {
    const raw = await fs.readFile(STATUS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<OrchestratorStatus>;
    return { ...EMPTY_STATUS, ...parsed };
  } catch {
    return { ...EMPTY_STATUS };
  }
}

// Mutex simple: encadena cada escritura tras la anterior para evitar que dos
// writers (/answer, /action, /chat) se pisen al leer-modificar-escribir.
let writeChain: Promise<void> = Promise.resolve();

export function writeStatus(status: OrchestratorStatus): Promise<void> {
  const run = async (): Promise<void> => {
    await fs.writeFile(STATUS_FILE, JSON.stringify(status, null, 2), "utf-8");
  };
  writeChain = writeChain.then(run, run);
  return writeChain;
}
```

> Nota: el test de mutex verifica que no se pierdan escrituras serializadas
> (cada `writeStatus` se encola tras la anterior). El patrón read-modify-write
> concurrente real lo protege el job único de chat, no este mutex.

- [ ] **Step 4: Correr el test → pasa**

Run: `npm test -w @stf/api`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/status.service.ts apps/api/src/services/status.service.test.ts
git commit -m "feat(api): status.service compartido con mutex de escritura"
```

---

## Task 3: chat.service — parser de stream-json + guard de ocupado

**Files:**

- Create: `apps/api/src/services/chat.service.ts`
- Create: `apps/api/src/services/chat.service.test.ts`

**Interfaces:**

- Consumes: `readStatus`, `writeStatus`, `ChatMessage` de `status.service.js`.
- Produces:
  - `type ChatStreamEvent = { kind: "assistant_text"; text: string } | { kind: "progress"; text: string } | { kind: "result"; text: string }`
  - `function parseStreamEvent(obj: unknown): ChatStreamEvent | null`
  - `function isBusy(): boolean`
  - `function startChat(message: string): Promise<{ jobId: string } | { busy: true }>`

- [ ] **Step 1: Escribir los tests del parser y del guard**

Crear `apps/api/src/services/chat.service.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseStreamEvent } from "./chat.service.js";

describe("parseStreamEvent", () => {
  it("clasifica texto del asistente", () => {
    const ev = parseStreamEvent({
      type: "assistant",
      message: { content: [{ type: "text", text: "hola" }] },
    });
    expect(ev).toEqual({ kind: "assistant_text", text: "hola" });
  });

  it("clasifica tool_use como progreso", () => {
    const ev = parseStreamEvent({
      type: "assistant",
      message: { content: [{ type: "tool_use", name: "Edit" }] },
    });
    expect(ev).toEqual({ kind: "progress", text: "🔧 Edit" });
  });

  it("clasifica el result final", () => {
    const ev = parseStreamEvent({
      type: "result",
      subtype: "success",
      result: "listo",
    });
    expect(ev).toEqual({ kind: "result", text: "listo" });
  });

  it("ignora eventos de sistema/hook", () => {
    expect(parseStreamEvent({ type: "system", subtype: "hook_started" })).toBeNull();
  });

  it("ignora objetos sin type", () => {
    expect(parseStreamEvent({ foo: 1 })).toBeNull();
  });
});
```

- [ ] **Step 2: Correr → falla (no existe chat.service)**

Run: `npm test -w @stf/api`
Expected: FAIL — no encuentra `./chat.service.js`.

- [ ] **Step 3: Implementar chat.service.ts**

Crear `apps/api/src/services/chat.service.ts`:

```typescript
import { spawn } from "child_process";
import { readStatus, writeStatus } from "./status.service.js";

export type ChatStreamEvent =
  | { kind: "assistant_text"; text: string }
  | { kind: "progress"; text: string }
  | { kind: "result"; text: string };

interface AnyObj {
  [k: string]: unknown;
}

/** Clasifica un evento NDJSON de `claude --output-format stream-json`. */
export function parseStreamEvent(obj: unknown): ChatStreamEvent | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as AnyObj;

  if (o.type === "result" && typeof o.result === "string") {
    return { kind: "result", text: o.result };
  }

  if (o.type === "assistant") {
    const msg = o.message as AnyObj | undefined;
    const content = (msg?.content as AnyObj[] | undefined) ?? [];
    for (const block of content) {
      if (block?.type === "text" && typeof block.text === "string") {
        return { kind: "assistant_text", text: block.text };
      }
      if (block?.type === "tool_use" && typeof block.name === "string") {
        return { kind: "progress", text: `🔧 ${block.name}` };
      }
    }
  }

  return null;
}

// ── Estado del job (uno a la vez) ───────────────────────────────────────────
const REPO_ROOT = process.env.SIAST_ROOT ?? process.cwd();
const TIMEOUT_MS = 10 * 60 * 1000;

let running = false;

export function isBusy(): boolean {
  return running;
}

async function appendChat(role: "user" | "assistant", text: string): Promise<void> {
  const status = await readStatus();
  status.chat = [...(status.chat ?? []), { role, text, ts: new Date().toISOString() }].slice(-50);
  status.updatedAt = new Date().toISOString();
  await writeStatus(status);
}

async function appendLog(msg: string, type: string): Promise<void> {
  const status = await readStatus();
  status.log = [
    { ts: new Date().toISOString(), msg, type },
    ...(Array.isArray(status.log) ? status.log : []),
  ].slice(0, 80);
  status.updatedAt = new Date().toISOString();
  await writeStatus(status);
}

/**
 * Spawnea `claude -p` headless en el repo. El prompt va por stdin (nunca en la
 * línea de comandos) para evitar inyección; los args son literales estáticos,
 * así que `shell: true` (necesario en Windows para el shim .cmd) es seguro.
 */
export async function startChat(message: string): Promise<{ jobId: string } | { busy: true }> {
  if (running) return { busy: true };
  running = true;
  const jobId = `chat-${Date.now()}`;

  await appendChat("user", message);
  await appendLog("🧭 Orquestador: procesando solicitud…", "warn");

  const child = spawn(
    "claude",
    ["-p", "--output-format", "stream-json", "--verbose", "--dangerously-skip-permissions"],
    { cwd: REPO_ROOT, shell: true },
  );

  const killer = setTimeout(() => child.kill(), TIMEOUT_MS);

  let buffer = "";
  let finalText = "";

  child.stdout.setEncoding("utf-8");
  child.stdout.on("data", (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let obj: unknown;
      try {
        obj = JSON.parse(trimmed);
      } catch {
        continue;
      }
      const ev = parseStreamEvent(obj);
      if (!ev) continue;
      if (ev.kind === "result") finalText = ev.text;
      else if (ev.kind === "progress") void appendLog(ev.text, "info");
    }
  });

  child.on("close", (code) => {
    clearTimeout(killer);
    running = false;
    if (finalText) void appendChat("assistant", finalText);
    else
      void appendChat(
        "assistant",
        code === 0 ? "(sin respuesta)" : `⚠ El orquestador terminó con código ${code}`,
      );
    void appendLog("🧭 Orquestador: solicitud completada", "success");
  });

  child.on("error", (err) => {
    clearTimeout(killer);
    running = false;
    void appendChat("assistant", `⚠ No se pudo iniciar claude: ${err.message}`);
  });

  child.stdin.write(message);
  child.stdin.end();

  return { jobId };
}
```

- [ ] **Step 4: Correr → pasa el parser**

Run: `npm test -w @stf/api`
Expected: PASS (5 tests del parser + los 2 de status).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/chat.service.ts apps/api/src/services/chat.service.test.ts
git commit -m "feat(api): chat.service — spawn claude -p + parser stream-json"
```

---

## Task 4: Controller + ruta /chat

**Files:**

- Modify: `apps/api/src/controllers/orchestrator.controller.ts`
- Modify: `apps/api/src/routes/orchestrator.routes.ts:16-19`

**Interfaces:**

- Consumes: `isBusy`, `startChat` de `chat.service.js`; `readStatus`, `writeStatus`, tipos de `status.service.js`.
- Produces: `export const postChat: (req: Request, res: Response) => Promise<void>`.

- [ ] **Step 1: Refactor del controller para usar status.service**

En `apps/api/src/controllers/orchestrator.controller.ts`:

Eliminar las definiciones locales de `OrchestratorQuestion`, `OrchestratorCommand`,
`OrchestratorStatus`, `EMPTY_STATUS`, `readStatus`, `writeStatus` (líneas ~63-96 y
~261-274 del archivo actual) y reemplazarlas por un import al inicio:

```typescript
import {
  readStatus,
  writeStatus,
  type OrchestratorStatus,
  type OrchestratorCommand,
} from "../services/status.service.js";
import { isBusy, startChat } from "../services/chat.service.js";
```

> El campo `chat[]` ya viene incluido en `OrchestratorStatus` y en `getStatus`
> (que hace `res.json({ ...status, vitals })`), así que el dashboard lo recibe sin
> cambios extra en `getStatus`.

- [ ] **Step 2: Añadir postChat al final del controller**

Añadir al final de `orchestrator.controller.ts`:

```typescript
/**
 * POST /api/orchestrator/chat — chat agéntico real. Spawnea `claude -p` en el
 * repo. SOLO-LOCAL salvo DASHBOARD_CHAT_REMOTE=true (ejecuta Claude con permisos
 * amplios sobre el repo; no exponer por túnel sin querer). Asíncrono: responde
 * 202 y la conversación aparece por el poll de /status.
 * Body: { message: string }
 */
export const postChat = async (req: Request, res: Response): Promise<void> => {
  const viaTunnel = Boolean(req.get("cf-connecting-ip"));
  if (viaTunnel && process.env.DASHBOARD_CHAT_REMOTE !== "true") {
    res.status(403).json({ error: "Chat no expuesto públicamente (solo-local)" });
    return;
  }

  const { message } = req.body ?? {};
  if (typeof message !== "string" || !message.trim()) {
    res.status(400).json({ error: "Se requiere 'message' (texto no vacío)" });
    return;
  }

  if (isBusy()) {
    res.status(409).json({ error: "El orquestador está ocupado con otra solicitud" });
    return;
  }

  const result = await startChat(message.trim());
  if ("busy" in result) {
    res.status(409).json({ error: "El orquestador está ocupado con otra solicitud" });
    return;
  }
  res.status(202).json({ ok: true, jobId: result.jobId });
};
```

- [ ] **Step 3: Registrar la ruta**

En `apps/api/src/routes/orchestrator.routes.ts`, tras la línea `router.post("/action", ctrl.postAction);`:

```typescript
router.post("/chat", ctrl.postChat);
```

- [ ] **Step 4: Verificar typecheck/build**

Run: `npm run build -w @stf/api`
Expected: build OK, sin errores de tipos (el controller ya no define los tipos que movimos).

- [ ] **Step 5: Verificación manual del endpoint (local)**

Arrancar la API (`npm run dev:api`) en otra terminal. Luego:

Run: `curl -s -X POST http://localhost:5101/api/orchestrator/chat -H "Content-Type: application/json" -d '{"message":"responde solo: pong"}'`
Expected: `{"ok":true,"jobId":"chat-..."}` con código 202.

Run (verificar guard remoto): `curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:5101/api/orchestrator/chat -H "Content-Type: application/json" -H "cf-connecting-ip: 1.2.3.4" -d '{"message":"x"}'`
Expected: `403`.

Luego `curl -s http://localhost:5101/api/orchestrator/status | grep -o '"chat":\[.*\]'` debe mostrar el mensaje "responde solo: pong" y, segundos después, la respuesta del asistente "pong".

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/controllers/orchestrator.controller.ts apps/api/src/routes/orchestrator.routes.ts
git commit -m "feat(api): endpoint POST /chat (solo-local) para el orquestador"
```

---

## Task 5: Dashboard — panel de transcript + ENVIAR → /chat

**Files:**

- Modify: `agent-dashboard.html`

**Interfaces:**

- Consumes: `GET /status` ahora incluye `chat: ChatMessage[]`; `POST /chat` devuelve 202 o 409.

- [ ] **Step 1: Añadir el contenedor de transcript en la cmdbar**

En `agent-dashboard.html`, dentro de `<div class="cmdbar">` (línea ~476), justo antes de
`<div class="cmd-queue" id="cmdQueue"></div>`, insertar:

```html
<div class="chat-transcript" id="chatTranscript"></div>
```

- [ ] **Step 2: Añadir estilos del transcript**

En el `<style>`, tras el bloque `.cmdbar { … }` (línea ~271), añadir:

```css
.chat-transcript {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 120px;
  overflow-y: auto;
  padding: 2px 0;
}
.chat-msg {
  font-size: 12px;
  line-height: 1.45;
  padding: 3px 7px;
  border-left: 2px solid;
}
.chat-msg.user {
  border-color: var(--orange);
  color: var(--text);
}
.chat-msg.assistant {
  border-color: var(--cyan);
  color: #d8e6ff;
  background: rgba(0, 229, 255, 0.04);
}
.chat-msg .who {
  font-family: var(--pf);
  font-size: 6px;
  letter-spacing: 0.5px;
  margin-right: 6px;
}
.chat-msg.user .who {
  color: var(--orange);
}
.chat-msg.assistant .who {
  color: var(--cyan);
}
.chat-msg.pending {
  opacity: 0.6;
  font-style: italic;
}
```

- [ ] **Step 3: Añadir estado y render del chat**

En el bloque de STATE (línea ~544), tras `let commands = [];` añadir:

```javascript
let chat = [];
let chatPending = false;
```

Tras la función `renderCommands()` (línea ~848) añadir:

```javascript
function renderChat() {
  const el = document.getElementById("chatTranscript");
  if (!el) return;
  const rows = chat.map(
    (m) => `
<div class="chat-msg ${m.role}">
  <span class="who">${m.role === "user" ? "TÚ" : "🧭 ORQ"}</span>${escHtml(m.text)}
</div>`,
  );
  if (chatPending) {
    rows.push(
      '<div class="chat-msg assistant pending"><span class="who">🧭 ORQ</span>pensando…</div>',
    );
  }
  el.innerHTML = rows.join("");
  el.scrollTop = el.scrollHeight;
}
```

- [ ] **Step 4: Incluir renderChat en render() y en fetchLive**

En `render()` (línea ~850) añadir `renderChat();` al final de la lista de llamadas.

En `fetchLive()` (línea ~890), junto a `commands = …`, añadir:

```javascript
chat = Array.isArray(data.chat) ? data.chat : [];
// Si el backend ya devolvió la respuesta del asistente, quitar el "pensando…"
if (chatPending && chat.length && chat[chat.length - 1].role === "assistant") {
  chatPending = false;
}
```

- [ ] **Step 5: Reescribir sendChatRequest para usar /chat**

Reemplazar la función `sendChatRequest()` (líneas ~691-716) por:

```javascript
async function sendChatRequest() {
  const input = document.getElementById("cmdInput");
  const btn = document.getElementById("cmdSend");
  const text = (input?.value || "").trim();
  if (!text) return;
  input.disabled = true;
  btn.disabled = true;
  btn.textContent = "…";
  // Optimista: pintar el mensaje del usuario + "pensando…"
  chat = [...chat, { role: "user", text, ts: new Date().toISOString() }];
  chatPending = true;
  renderChat();
  try {
    const r = await fetch(API_BASE + "/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...KEY_HEADERS },
      body: JSON.stringify({ message: text }),
    });
    if (r.status === 409) {
      chatPending = false;
      renderChat();
      addLog("Orquestador ocupado — espera a que termine la solicitud actual", "warn");
      return;
    }
    if (!r.ok) throw new Error();
    addLog("Solicitud enviada al orquestador: " + text, "warn");
    input.value = "";
  } catch {
    chatPending = false;
    renderChat();
    addLog("No se pudo enviar al orquestador (¿API en :5101?)", "error");
  } finally {
    input.disabled = false;
    btn.disabled = false;
    btn.textContent = "ENVIAR";
    input.focus();
  }
}
```

- [ ] **Step 6: Actualizar el placeholder del input**

En el `<input class="cmd-input" id="cmdInput" …>` (línea ~480), cambiar el `placeholder` a:

```
placeholder="Escribe una orden para el orquestador (edita código, corre agentes…) y pulsa Enter…"
```

- [ ] **Step 7: Verificación manual end-to-end**

Con la API corriendo, abrir `http://localhost:5101/api/orchestrator/dashboard`.
Escribir "responde solo: pong" y Enter.
Expected:

1. Aparece tu mensaje + "pensando…" de inmediato.
2. En TERMINAL OUTPUT se ven líneas de progreso (`🧭 Orquestador: procesando…`).
3. En ~5-15 s el "pensando…" se reemplaza por la respuesta del asistente "pong".

- [ ] **Step 8: Commit**

```bash
git add agent-dashboard.html
git commit -m "feat(dashboard): chat real con el orquestador (ENVIAR → /chat)"
```

---

## Task 6: Documentar el flag y cierre

**Files:**

- Modify: `.env.example` (si existe en la raíz o en `apps/api`)

- [ ] **Step 1: Documentar DASHBOARD_CHAT_REMOTE**

Localizar `.env.example`:

Run: `ls .env.example apps/api/.env.example 2>/dev/null`

En el `.env.example` que exista, junto a `DASHBOARD_TOKEN`, añadir:

```bash
# Permite usar el chat del orquestador (POST /chat) por túnel/Tailscale.
# Por defecto el chat es SOLO-LOCAL porque ejecuta claude agéntico en el repo.
DASHBOARD_CHAT_REMOTE=false
```

Si no existe ningún `.env.example`, omitir este paso (no crear uno nuevo).

- [ ] **Step 2: Suite completa de tests**

Run: `npm test -w @stf/api`
Expected: PASS — 7 tests (2 status + 5 parser).

- [ ] **Step 3: Build final**

Run: `npm run build -w @stf/api`
Expected: build OK.

- [ ] **Step 4: Commit**

```bash
git add .env.example apps/api/.env.example 2>/dev/null
git commit -m "docs(api): documenta DASHBOARD_CHAT_REMOTE" --allow-empty
```

---

## Task 7: Vitals ligados al HP + distribución profesional + dinamismo

**Files:**

- Modify: `apps/api/src/controllers/orchestrator.controller.ts` (función `buildVitals`)
- Modify: `agent-dashboard.html`

**Interfaces:**

- Consumes: `vitals.hp`, `vitals.suggestions` ya existentes en `GET /status`.
- Produces: botones de acción cuyo `id`/`label`/`severity` dependen de la banda de HP.

**Mapa de bandas (botón ↔ HP%):**

| HP restante | Botón                              | severity |
| ----------- | ---------------------------------- | -------- |
| > 55%       | — (o 💤 Descansar si waste ≥ 8000) | warn     |
| 35–55%      | 💤 Descansar                       | warn     |
| 20–35%      | 📦 Compactar                       | warn     |
| < 20%       | 🧹 Limpiar + 📦 Compactar          | crit     |

- [ ] **Step 1: Reescribir las sugerencias de buildVitals por banda de HP**

En `apps/api/src/controllers/orchestrator.controller.ts`, dentro de `buildVitals`,
reemplazar el bloque que arranca en `// Sugerencias accionables a partir de las señales`
(las declaraciones `waste/stale/dupes/densityScore/densityRatio` y los tres `if` de
`suggestions.push`) por:

```typescript
// Sugerencias accionables ligadas a la BANDA DE HP (contexto restante).
// HP = 100 - fillPct. Bandas: >55 sano · 35-55 descansar · 20-35 compactar · <20 limpiar.
const suggestions: Suggestion[] = [];
const waste = Number(q.breakdown?.total_estimated_waste_tokens ?? 0);

if (hp < 20) {
  suggestions.push({
    id: "limpiar-contexto",
    label: "🧹 Limpiar contexto",
    reason: `HP ${hp}% — crítico: limpia el contexto (/clear) para recuperar HP`,
    severity: "crit",
    action: "Limpiar el contexto de la conversación (/clear)",
  });
  suggestions.push({
    id: "compactar",
    label: "📦 Compactar",
    reason: `HP ${hp}% — compacta para no perder el hilo (/compact)`,
    severity: "crit",
    action: "Compactar la conversación (/compact)",
  });
} else if (hp < 35) {
  suggestions.push({
    id: "compactar",
    label: "📦 Compactar",
    reason: `HP ${hp}% — bajo: conviene compactar pronto (/compact)`,
    severity: "warn",
    action: "Compactar la conversación (/compact)",
  });
} else if (hp < 55) {
  suggestions.push({
    id: "descansar",
    label: "💤 Descansar",
    reason: `HP ${hp}% — descansa: limpia lecturas viejas y duplicados`,
    severity: "warn",
    action: "Descansar: limpiar lecturas obsoletas y duplicados del contexto",
  });
} else if (waste >= 8000) {
  suggestions.push({
    id: "descansar",
    label: "💤 Descansar",
    reason: `${waste.toLocaleString()} tokens en lecturas viejas — descansa para recuperar VIGOR`,
    severity: "warn",
    action: "Descansar: limpiar lecturas obsoletas y duplicados del contexto",
  });
}
```

> Las variables `stale`, `dupes`, `densityScore`, `densityRatio` quedan sin uso:
> eliminarlas para que el build (sin `any` colgando) quede limpio.

- [ ] **Step 2: Verificar build del API**

Run: `npm run build -w @stf/api`
Expected: build OK, sin variables sin usar.

- [ ] **Step 3: Dar más altura a la barra de chat (distribución)**

En `agent-dashboard.html`, en `.app { grid-template-rows: … }` (línea ~49), cambiar la
fila `cm` de `82px` a `156px` para alojar el transcript sin recortar:

```css
grid-template-rows: 62px 1fr 80px 142px 156px 34px;
```

- [ ] **Step 4: Conteo animado de HP / VIGOR (dinamismo)**

En `agent-dashboard.html`, antes de `function renderVitals()` (línea ~614), añadir el helper:

```javascript
// Tween de números (ease-out cúbico) para HP/VIGOR — más vivo que el salto seco.
function animateNum(el, to, suffix = "") {
  if (!el) return;
  const from = parseInt(el.dataset.val ?? "0", 10) || 0;
  el.dataset.val = String(to);
  if (from === to) {
    el.textContent = to + suffix;
    return;
  }
  const start = performance.now(),
    dur = 600;
  function step(now) {
    const t = Math.min(1, (now - start) / dur);
    const v = Math.round(from + (to - from) * (1 - Math.pow(1 - t, 3)));
    el.textContent = v + suffix;
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
```

Dentro de `renderVitals`, reemplazar `hpPct.textContent = hp + '%';` por:

```javascript
animateNum(hpPct, hp, "%");
```

y reemplazar `vigorPct.textContent = vigor + '%';` por:

```javascript
animateNum(vigorPct, vigor, "%");
```

- [ ] **Step 5: Pulso del label HP en zona crítica**

En el `<style>`, tras `.bar-label.hp { color: var(--green); }` (línea ~126), añadir:

```css
.bar-label.hp.crit {
  color: var(--red);
  animation: blink 1s infinite;
}
```

Dentro de `renderVitals`, tras calcular `hp`, añadir:

```javascript
document.querySelector(".bar-label.hp")?.classList.toggle("crit", hp < 20);
```

- [ ] **Step 6: Glow del panel de chat + puntos animados mientras "piensa"**

En el `<style>`, tras el bloque `.cmdbar { … }` (línea ~271), añadir:

```css
.cmdbar.thinking {
  animation: cmdGlow 1.3s ease-in-out infinite;
}
@keyframes cmdGlow {
  0%,
  100% {
    box-shadow: 0 0 0 rgba(0, 229, 255, 0);
    border-color: var(--bright);
  }
  50% {
    box-shadow: 0 0 16px rgba(0, 229, 255, 0.35);
    border-color: var(--cyan);
  }
}
.think-dots i {
  animation: blink 1.2s infinite;
}
.think-dots i:nth-child(2) {
  animation-delay: 0.2s;
}
.think-dots i:nth-child(3) {
  animation-delay: 0.4s;
}
```

En `renderChat()` (de la Task 5), reemplazar la línea del placeholder `pensando…` por:

```javascript
if (chatPending) {
  rows.push(
    '<div class="chat-msg assistant pending"><span class="who">🧭 ORQ</span>pensando<span class="think-dots"><i>.</i><i>.</i><i>.</i></span></div>',
  );
}
```

y al final de `renderChat()`, antes del `el.scrollTop`, alternar el glow del panel:

```javascript
document.querySelector(".cmdbar")?.classList.toggle("thinking", chatPending);
```

- [ ] **Step 7: Verificación manual del dinamismo**

Abrir el dashboard local. Verificar:

1. HP/VIGOR cuentan suave al refrescar (no salto seco).
2. Con HP simulado < 20% (o real bajo) el label HP parpadea en rojo y aparecen
   🧹 Limpiar + 📦 Compactar.
3. Al enviar una orden, el panel de chat hace glow y los puntos "…" se animan hasta
   que llega la respuesta.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/controllers/orchestrator.controller.ts agent-dashboard.html
git commit -m "feat(dashboard): vitals por banda de HP + distribución y dinamismo"
```

---

## Self-Review (cubierto)

- **Cobertura del spec:** endpoint `/chat` (T4), chat.service spawn+parser (T3), transcript en status (T2/T3), render dashboard (T5), guard solo-local (T4), flag documentado (T6), un-job-a-la-vez (T3 `isBusy`), mutex de escritura (T2). ✓
- **Cobertura de los extras de Jesse:** botones de acción por banda de HP (T7 S1), distribución profesional / altura del chat (T7 S3), dinamismo HP/VIGOR + glow chat + puntos animados + pulso HP crítico (T7 S4-S6). ✓
- **Sin placeholders:** todos los pasos llevan código real o comando con salida esperada. ✓
- **Consistencia de tipos:** `ChatMessage`, `OrchestratorStatus`, `parseStreamEvent`, `isBusy`, `startChat` usados con las mismas firmas entre T2→T3→T4→T5; `Suggestion` reutilizado en T7. ✓
- **Seguridad:** prompt por stdin + args estáticos (sin inyección); solo-local por defecto. ✓
