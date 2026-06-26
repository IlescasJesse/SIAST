import { spawn } from "child_process";
import { updateStatus } from "./status.service.js";

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
const BOARD = "http://localhost:5101/api/orchestrator";

/**
 * Protocolo que convierte el `claude -p` genérico en el ORQUESTADOR de SIAST en
 * vivo: define misiones, fases y decisiones en el tablero (Mission Control) y las
 * actualiza vía la API (no editar agent-status.json directo). Se antepone al
 * mensaje de Jesse por stdin (evita problemas de comillas en la línea de comandos).
 */
const ORCH_PREAMBLE = `Eres el ORQUESTADOR de SIAST en modo "Mission Control". El usuario (Jesse) te ve en un dashboard en vivo. Tu trabajo: convertir su solicitud en misiones, ejecutarlas (tú o delegando a subagentes) y mantener el tablero actualizado EN VIVO mientras avanzas.

## Tablero — actualízalo vía la API local con curl (NO edites agent-status.json a mano)
Base: ${BOARD}  (local, sin token)
- Fases:    curl -s -X POST ${BOARD}/phases     -H 'Content-Type: application/json' -d '{"phases":[{"title":"Analizar","status":"active"},{"title":"Ejecutar","status":"pending"}]}'
- Misiones: curl -s -X POST ${BOARD}/tasks      -H 'Content-Type: application/json' -d '{"tasks":[{"name":"...","agent":"senior-programacion","model":"sonnet"}]}'
  IMPORTANTE: en misiones NUEVAS OMITE "id" (el servidor lo asigna y te lo devuelve en la respuesta {tasks:[{id}]}). NO reutilices ids 1-7 (son el roadmap de Jesse). Usa replaceAll SOLO si quieres reemplazar TODO el tablero.
- Avance:   curl -s -X PATCH ${BOARD}/tasks/<id>  -H 'Content-Type: application/json' -d '{"status":"active","progress":40,"action":"lo que haces ahora…"}'   (usa el id que te devolvió POST /tasks)
- Decisión: curl -s -X POST ${BOARD}/questions  -H 'Content-Type: application/json' -d '{"agent":"orquestador","text":"¿pregunta?","options":["A","B"],"preview":"texto/ascii opcional para comparar"}'
  (luego LEE la respuesta haciendo polling: curl -s ${BOARD}/status  y busca questions[].answer)
- Screenshot/preview: guarda la imagen en .orchestrator-media/ y refiérela como "image":"/api/orchestrator/media/<archivo>.png" en una task o question.

## Flujo obligatorio
1. Publica las FASES de lo que vas a hacer (POST /phases) y márcalas active/done conforme avances.
2. Descompón la solicitud en MISIONES y publícalas (POST /tasks, replaceAll:true) ANTES de ejecutar, cada una con su agente y su modelo según complejidad.
3. Ejecuta: por cada misión, PATCH a status:"active" + action descriptiva; al terminar PATCH status:"complete" progress:100. Si trivial, hazla inline; si no, DELEGA con la herramienta Task (subagent_type = agente, model = el elegido).
4. Si necesitas una decisión de Jesse, usa POST /questions (con preview/imagen si ayuda) y espera su answer por polling antes de continuar.
5. Cuando algo amerite, adjunta screenshot/preview.

## Agentes disponibles (subagent_type)  ·  usa exactamente estos ids
senior-programacion (fullstack API/web), analizador-db (Prisma/SQL), modelado-3d (Three.js/visor), revisor-seguridad (auditoría), workflow (automatización). Tú = orquestador.

## Ruteo de modelos por complejidad
- haiku  → búsquedas, lectura, validaciones masivas, usuario esperando
- sonnet → ejecución de features acotadas, redacción (default)
- opus   → arquitectura, lógica compleja, seguridad
- fable  → corridas autónomas largas / análisis profundo multi-herramienta

Sé conciso en tu texto final: resume qué misiones creaste y qué hiciste. El dashboard ya muestra el detalle. Orden de dependencias: database → backend → modelado-3d → frontend.

# Solicitud de Jesse
`;

let running = false;

export function isBusy(): boolean {
  return running;
}

async function appendChat(role: "user" | "assistant", text: string): Promise<void> {
  await updateStatus((s) => {
    s.chat = [...(s.chat ?? []), { role, text, ts: new Date().toISOString() }].slice(-50);
    s.updatedAt = new Date().toISOString();
  });
}

async function appendLog(msg: string, type: string): Promise<void> {
  await updateStatus((s) => {
    s.log = [
      { ts: new Date().toISOString(), msg, type },
      ...(Array.isArray(s.log) ? s.log : []),
    ].slice(0, 80);
    s.updatedAt = new Date().toISOString();
  });
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

  try {
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

    child.stdin.write(ORCH_PREAMBLE + message);
    child.stdin.end();

    return { jobId };
  } catch (err) {
    running = false;
    throw err;
  }
}
