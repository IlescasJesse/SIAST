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

    child.stdin.write(message);
    child.stdin.end();

    return { jobId };
  } catch (err) {
    running = false;
    throw err;
  }
}
