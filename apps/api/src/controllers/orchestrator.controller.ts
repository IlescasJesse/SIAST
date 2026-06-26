import type { Request, Response } from "express";
import { fileURLToPath } from "url";
import path from "path";
import os from "os";
import fs from "fs/promises";
import { timingSafeEqual } from "crypto";
import {
  readStatus,
  updateStatus,
  type OrchestratorStatus,
  type OrchestratorCommand,
} from "../services/status.service.js";
import { isBusy, startChat } from "../services/chat.service.js";

/**
 * Orquestador — estado en vivo de los agentes para `agent-dashboard.html`.
 *
 * Persistencia simple basada en un archivo JSON en la raíz del repo
 * (`agent-status.json`). El orquestador (Claude) escribe ese archivo conforme
 * delega trabajo; el dashboard lo lee vía GET /status cada 2.5 s y envía las
 * respuestas de Jesse vía POST /answer.
 *
 * No expone datos sensibles (solo progreso de tareas y preguntas de UI), por
 * eso el router se monta con CORS abierto y SIN authMiddleware: el dashboard se
 * abre como archivo local (origin "null") y no dispone de JWT.
 */

// Raíz del repo: apps/api/src/controllers → ../../../../
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = process.env.SIAST_ROOT ?? path.resolve(__dirname, "../../../..");
const DASHBOARD_FILE = path.join(REPO_ROOT, "agent-dashboard.html");

/**
 * Guard de acceso al dashboard del orquestador. Como estas rutas se exponen a
 * internet vía túnel (Cloudflare) y NO usan JWT, exigimos un token compartido
 * (DASHBOARD_TOKEN). Se acepta por query `?key=` (para abrir la URL en el
 * navegador) o header `x-dashboard-key` (para los fetch del propio dashboard).
 * Si DASHBOARD_TOKEN no está configurado, se bloquea el acceso por seguridad.
 */
export const dashboardAuth = (req: Request, res: Response, next: () => void): void => {
  // Acceso local (npm run dev, sin túnel): el dashboard debe "just work" sin
  // fricción. Solo exigimos token cuando la petición llega por el túnel público
  // (Cloudflare/ngrok añaden cf-connecting-ip). Así el dashboard se conecta EN
  // VIVO a la API en desarrollo aunque no haya DASHBOARD_TOKEN configurado.
  const viaTunnel = Boolean(req.get("cf-connecting-ip"));
  if (!viaTunnel) {
    next();
    return;
  }
  const expected = process.env.DASHBOARD_TOKEN;
  if (!expected) {
    res.status(503).json({ error: "DASHBOARD_TOKEN no configurado en el servidor" });
    return;
  }
  const provided =
    (typeof req.query.key === "string" ? req.query.key : undefined) ??
    req.get("x-dashboard-key") ??
    "";
  // Comparación de longitud constante para evitar timing attacks
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    res.status(401).json({ error: "Token de dashboard inválido o ausente" });
    return;
  }
  next();
};

// ── VITALS: salud del contexto (VIGOR + HP) ─────────────────────────────────
// Lee el quality-cache de la sesión de Claude que trabaja EN ESTE repo (SIAST),
// no el más reciente global. Si tomáramos el más fresco de cualquier sesión, el
// HP reflejaría otro proyecto (p. ej. SIRH-NG) y no el uso real de SIAST.
const TOKEN_OPT_DIR = path.join(os.homedir(), ".claude", "token-optimizer");
// Carpeta de sesiones de Claude Code para ESTE repo. Claude codifica la ruta del
// proyecto reemplazando ':' '\' '/' por '-' (ej. C--Users-ilesm-Documents-SIAST).
const PROJECT_SESSIONS_DIR = path.join(
  os.homedir(),
  ".claude",
  "projects",
  REPO_ROOT.replace(/[:\\/]/g, "-"),
);

interface Suggestion {
  id: string;
  label: string;
  reason: string;
  severity: "warn" | "crit";
  action: string;
}

/** Lee y parsea un quality-cache concreto por id de sesión. */
async function readQualityCacheById(sessionId: string): Promise<Record<string, any> | null> {
  try {
    const raw = await fs.readFile(
      path.join(TOKEN_OPT_DIR, `quality-cache-${sessionId}.json`),
      "utf-8",
    );
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Ids de las sesiones de SIAST ordenadas de más reciente a más antigua. */
async function siastSessionIdsByRecency(): Promise<string[]> {
  try {
    const files = await fs.readdir(PROJECT_SESSIONS_DIR);
    const sessions = files.filter((f) => f.endsWith(".jsonl"));
    const withMtime: { id: string; mtime: number }[] = [];
    for (const f of sessions) {
      const stat = await fs.stat(path.join(PROJECT_SESSIONS_DIR, f));
      withMtime.push({ id: f.replace(/\.jsonl$/, ""), mtime: stat.mtimeMs });
    }
    return withMtime.sort((a, b) => b.mtime - a.mtime).map((s) => s.id);
  } catch {
    return [];
  }
}

/** Fallback: quality-cache más reciente de CUALQUIER sesión (último recurso). */
async function readFreshestQualityCacheGlobal(): Promise<Record<string, any> | null> {
  try {
    const files = await fs.readdir(TOKEN_OPT_DIR);
    const caches = files.filter((f) => f.startsWith("quality-cache-") && f.endsWith(".json"));
    if (caches.length === 0) return null;
    let newest: { file: string; mtime: number } | null = null;
    for (const f of caches) {
      const stat = await fs.stat(path.join(TOKEN_OPT_DIR, f));
      if (!newest || stat.mtimeMs > newest.mtime) newest = { file: f, mtime: stat.mtimeMs };
    }
    if (!newest) return null;
    const raw = await fs.readFile(path.join(TOKEN_OPT_DIR, newest.file), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * VITALS de la sesión de SIAST: busca la sesión de Claude más reciente de ESTE
 * repo y lee su quality-cache. Si no hay (o token-optimizer aún no la cacheó),
 * cae al más reciente global como último recurso.
 */
async function readFreshestQualityCache(): Promise<Record<string, any> | null> {
  // Recorre las sesiones de SIAST de más reciente a más antigua y devuelve el
  // primer quality-cache que exista. La sesión EN CURSO puede no estar cacheada
  // todavía (token-optimizer la genera periódicamente), así que se usa la última
  // sesión de SIAST que sí tenga vitals en vez de saltar a otro proyecto.
  const sessionIds = await siastSessionIdsByRecency();
  for (const id of sessionIds) {
    const cache = await readQualityCacheById(id);
    if (cache) return cache;
  }
  return readFreshestQualityCacheGlobal();
}

/**
 * Llenado de contexto REAL y EN VIVO: lee la cola del transcript de la sesión
 * de SIAST más reciente y toma el `usage` del último mensaje del asistente. La
 * suma input + cache_read + cache_creation = tamaño del prompt que se envía cada
 * turno = contexto ocupado ahora mismo. Más fiable y fresco que el quality-cache
 * (que token-optimizer regenera con retraso → el HP "se quedaba congelado").
 */
async function readLiveContextTokens(): Promise<{ tokens: number; window: number } | null> {
  try {
    const ids = await siastSessionIdsByRecency();
    if (!ids.length) return null;
    const file = path.join(PROJECT_SESSIONS_DIR, `${ids[0]}.jsonl`);
    const fh = await fs.open(file, "r");
    try {
      const { size } = await fh.stat();
      const len = Math.min(size, 256 * 1024); // solo la cola (eficiente)
      const buf = Buffer.alloc(len);
      await fh.read(buf, 0, len, size - len);
      const lines = buf.toString("utf-8").split("\n").filter(Boolean);
      for (let i = lines.length - 1; i >= 0; i--) {
        let o: any;
        try {
          o = JSON.parse(lines[i]);
        } catch {
          continue; // primera línea puede venir cortada por el tail
        }
        const u = o?.message?.usage;
        if (u && typeof u.cache_read_input_tokens === "number") {
          const tokens =
            (u.input_tokens || 0) +
            (u.cache_read_input_tokens || 0) +
            (u.cache_creation_input_tokens || 0);
          return { tokens, window: 1_000_000 };
        }
      }
      return null;
    } finally {
      await fh.close();
    }
  } catch {
    return null;
  }
}

function buildVitals(
  q: Record<string, any> | null,
  live: { tokens: number; window: number } | null,
) {
  if (!q && !live) {
    return {
      available: false,
      vigor: null,
      grade: null,
      hp: null,
      fillPct: null,
      tokensUsed: null,
      tokensMax: null,
      tokensLeft: null,
      dead: false,
      suggestions: [] as Suggestion[],
    };
  }
  const vigor = q ? Math.round(q.score ?? 0) : null;
  // Ventana: la del contexto en vivo o la del cache (default 1M)
  const tokensMax = live
    ? live.window
    : Number(q?.breakdown?.context_fill_degradation?.model_context_window ?? 1_000_000);
  // Llenado: PREFERIR el conteo en vivo del transcript (fresco) sobre el cache.
  const fillPct = live ? Math.min(100, (live.tokens / tokensMax) * 100) : Number(q?.fill_pct ?? 0);
  const tokensUsed = live ? live.tokens : Math.round((fillPct / 100) * tokensMax);
  const tokensLeft = Math.max(0, tokensMax - tokensUsed);
  const hp = Math.max(0, Math.round(100 - fillPct));
  const dead = hp <= 0;

  // Sugerencias accionables a partir de las señales de calidad
  const suggestions: Suggestion[] = [];
  const waste = Number(q?.breakdown?.total_estimated_waste_tokens ?? 0);
  const stale = Number(q?.breakdown?.stale_reads?.count ?? 0);
  const dupes = Number(q?.breakdown?.duplicates?.count ?? 0);
  const densityScore = Number(q?.signals?.decision_density ?? 100);
  const densityRatio = Number(q?.breakdown?.decision_density?.ratio ?? 1);

  if (waste >= 3000 || stale >= 2 || dupes >= 1) {
    suggestions.push({
      id: "descansar",
      label: "💤 Descansar",
      reason: `${waste.toLocaleString()} tokens en lecturas viejas — descansa para recuperar VIGOR`,
      severity: waste >= 8000 ? "crit" : "warn",
      action: "Descansar: limpiar lecturas obsoletas y duplicados del contexto",
    });
  }
  if (fillPct >= 50) {
    suggestions.push({
      id: "compactar",
      label: "📦 Compactar",
      reason: `Contexto al ${fillPct.toFixed(0)}% — conviene compactar pronto`,
      severity: fillPct >= 75 ? "crit" : "warn",
      action: "Compactar la conversación (/compact)",
    });
  }
  if (densityScore < 60) {
    suggestions.push({
      id: "simplificar",
      label: "✂️ Simplificar respuestas",
      reason: `Solo ${Math.round(densityRatio * 100)}% del contexto es sustancial — respuestas muy largas`,
      severity: densityScore < 40 ? "crit" : "warn",
      action: "Respuestas más concisas, menos relleno",
    });
  }

  return {
    available: true,
    vigor,
    grade: q?.grade ?? null,
    hp,
    fillPct,
    tokensUsed,
    tokensMax,
    tokensLeft,
    dead,
    suggestions,
  };
}

/**
 * GET /api/orchestrator/dashboard — sirve el HTML del dashboard de agentes.
 * Permite abrirlo vía túnel (Cloudflare/ngrok) desde internet usando el mismo
 * origen que la API, de modo que `fetch('/api/orchestrator/...')` funcione sin
 * CORS ni mixed-content. Cuando se abre como archivo local usa localhost:5101.
 */
export const getDashboard = async (_req: Request, res: Response): Promise<void> => {
  res.sendFile(DASHBOARD_FILE, (err) => {
    if (err && !res.headersSent) res.status(404).send("agent-dashboard.html no encontrado");
  });
};

/** GET /api/orchestrator/status — estado completo + vitals (VIGOR/HP) para el dashboard */
export const getStatus = async (_req: Request, res: Response): Promise<void> => {
  const [status, qcache, live] = await Promise.all([
    readStatus(),
    readFreshestQualityCache(),
    readLiveContextTokens(),
  ]);
  res.json({ ...status, vitals: buildVitals(qcache, live) });
};

/**
 * POST /api/orchestrator/answer — Jesse responde una pregunta desde el dashboard.
 * Body: { id: string, answer: string }
 * Marca la pregunta con `answer` + `answeredAt` y registra el evento en el log.
 */
export const postAnswer = async (req: Request, res: Response): Promise<void> => {
  const { id, answer } = req.body ?? {};
  if (!id || typeof answer !== "string" || !answer.trim()) {
    res.status(400).json({ error: "Se requieren 'id' y 'answer' (texto no vacío)" });
    return;
  }

  // Read first to validate existence and return 404 early
  const preCheck = await readStatus();
  if (!preCheck.questions.find((q) => q.id === id)) {
    res.status(404).json({ error: `No existe la pregunta '${id}'` });
    return;
  }

  let savedQuestion: (typeof preCheck.questions)[number] | undefined;
  await updateStatus((s) => {
    const question = s.questions.find((q) => q.id === id);
    if (!question) return; // race: should not happen, handled above
    const now = new Date().toISOString();
    question.answer = answer.trim();
    question.answeredAt = now;
    s.log = [
      { ts: now, msg: `[${question.agent}] Jesse respondió: "${answer.trim()}"`, type: "success" },
      ...(Array.isArray(s.log) ? s.log : []),
    ].slice(0, 80);
    s.updatedAt = now;
    savedQuestion = question;
  });

  res.json({ ok: true, question: savedQuestion });
};

/**
 * POST /api/orchestrator/action — Jesse pulsa un botón de métricas (limpiar
 * contexto, compactar, simplificar…). Se registra como comando pendiente que el
 * orquestador (Claude) lee en su siguiente turno y ejecuta.
 * Body: { id: string, label?: string, action?: string }
 */
export const postAction = async (req: Request, res: Response): Promise<void> => {
  const { id, label, action } = req.body ?? {};
  if (!id || typeof id !== "string") {
    res.status(400).json({ error: "Se requiere 'id'" });
    return;
  }

  const now = new Date().toISOString();
  const command: OrchestratorCommand = {
    id,
    label: typeof label === "string" ? label : id,
    action: typeof action === "string" ? action : id,
    ts: now,
    done: false,
  };

  await updateStatus((s) => {
    s.commands = [command, ...(Array.isArray(s.commands) ? s.commands : [])].slice(0, 20);
    s.log = [
      { ts: now, msg: `Jesse solicitó: ${command.label}`, type: "warn" },
      ...(Array.isArray(s.log) ? s.log : []),
    ].slice(0, 80);
    s.updatedAt = now;
  });

  res.json({ ok: true, command });
};

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

// ════════════════════════════════════════════════════════════════════════════
// TABLERO DINÁMICO — el orquestador (claude -p) publica/actualiza misiones,
// fases, decisiones y screenshots a TRAVÉS de estos endpoints (mismo proceso →
// mismo mutex que el chat/log, sin condiciones de carrera con agent-status.json).
// ════════════════════════════════════════════════════════════════════════════

/** POST /tasks — define o actualiza misiones. Body: { tasks:[{name,agent,model,status,progress,action,depends}], replaceAll?, task? } */
export const postTasks = async (req: Request, res: Response): Promise<void> => {
  const body = req.body ?? {};
  const incoming = Array.isArray(body.tasks) ? body.tasks : body.task ? [body.task] : null;
  if (!incoming || !incoming.length) {
    res.status(400).json({ error: "Se requiere 'tasks' (array) o 'task'" });
    return;
  }
  for (const t of incoming) {
    if (!t || typeof t.name !== "string" || !t.name.trim()) {
      res.status(400).json({ error: "cada task requiere 'name' (texto)" });
      return;
    }
  }
  const replaceAll = body.replaceAll === true;
  const saved: any[] = [];
  await updateStatus((s) => {
    const tasks = replaceAll ? [] : Array.isArray(s.tasks) ? [...(s.tasks as any[])] : [];
    let maxId = tasks.reduce((m: number, t: any) => {
      const n = Number(t?.id);
      return Number.isFinite(n) && n > m ? n : m;
    }, 0);
    for (const inc of incoming) {
      const norm: any = { status: "pending", progress: 0, action: "", ...inc };
      if (norm.id === undefined || norm.id === null || norm.id === "") norm.id = ++maxId;
      const idx = tasks.findIndex((t: any) => String(t?.id) === String(norm.id));
      if (idx >= 0) tasks[idx] = { ...tasks[idx], ...norm };
      else tasks.push(norm);
      saved.push(norm);
    }
    s.tasks = tasks;
    const now = new Date().toISOString();
    s.log = [
      { ts: now, msg: `🧭 Orquestador definió ${incoming.length} misión(es)`, type: "warn" },
      ...(Array.isArray(s.log) ? s.log : []),
    ].slice(0, 80);
    s.updatedAt = now;
  });
  // Devuelve los ids asignados para que el orquestador haga PATCH /tasks/:id
  res.json({ ok: true, count: saved.length, tasks: saved });
};

/** PATCH /tasks/:id — actualiza una misión (status/progress/action/agent/model). */
export const patchTask = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const patch = req.body ?? {};
  let found: any = null;
  await updateStatus((s) => {
    const tasks = Array.isArray(s.tasks) ? (s.tasks as any[]) : [];
    const t = tasks.find((x: any) => String(x?.id) === String(id));
    if (!t) return;
    const prev = t.status;
    Object.assign(t, patch);
    found = t;
    const now = new Date().toISOString();
    if (patch.status && patch.status !== prev) {
      const verb =
        patch.status === "active"
          ? "▶ inició"
          : patch.status === "complete"
            ? "✓ completó"
            : patch.status === "blocked"
              ? "⛔ bloqueó"
              : patch.status;
      s.log = [
        {
          ts: now,
          msg: `[${t.agent || "orquestador"}] ${verb}: ${t.name}`,
          type: patch.status === "complete" ? "success" : "info",
        },
        ...(Array.isArray(s.log) ? s.log : []),
      ].slice(0, 80);
    }
    s.updatedAt = now;
  });
  if (!found) {
    res.status(404).json({ error: `No existe la tarea '${id}'` });
    return;
  }
  res.json({ ok: true, task: found });
};

/** POST /phases — fija las fases mostradas en el dashboard. Body: { phases:[{title,status,detail}] } */
export const postPhases = async (req: Request, res: Response): Promise<void> => {
  const phases = Array.isArray(req.body?.phases) ? req.body.phases : null;
  if (!phases) {
    res.status(400).json({ error: "Se requiere 'phases' (array)" });
    return;
  }
  for (const p of phases) {
    if (!p || typeof p.title !== "string") {
      res.status(400).json({ error: "cada phase requiere 'title'" });
      return;
    }
  }
  await updateStatus((s) => {
    s.phases = phases.map((p: any) => ({ status: "pending", ...p }));
    s.updatedAt = new Date().toISOString();
  });
  res.json({ ok: true, count: phases.length });
};

/** POST /questions — el orquestador pide una decisión a Jesse (con preview/screenshot opcional). */
export const postQuestion = async (req: Request, res: Response): Promise<void> => {
  const b = req.body ?? {};
  if (typeof b.text !== "string" || !b.text.trim()) {
    res.status(400).json({ error: "Se requiere 'text'" });
    return;
  }
  const q = {
    id: typeof b.id === "string" && b.id ? b.id : `q-${Date.now()}`,
    agent: typeof b.agent === "string" ? b.agent : "orquestador",
    text: b.text.trim(),
    options: Array.isArray(b.options) ? b.options : undefined,
    preview: typeof b.preview === "string" ? b.preview : undefined,
    image: typeof b.image === "string" ? b.image : undefined,
    answer: null,
    answeredAt: null,
  };
  await updateStatus((s) => {
    s.questions = [...(Array.isArray(s.questions) ? s.questions : []), q];
    const now = new Date().toISOString();
    s.log = [
      { ts: now, msg: `[${q.agent}] ❓ ${q.text}`, type: "warn" },
      ...(Array.isArray(s.log) ? s.log : []),
    ].slice(0, 80);
    s.updatedAt = now;
  });
  res.status(201).json({ ok: true, question: q });
};

// Carpeta de screenshots que el orquestador puede generar y referenciar como
// /api/orchestrator/media/<archivo>. basename() evita path traversal.
const MEDIA_DIR = path.join(REPO_ROOT, ".orchestrator-media");
export const getMedia = async (req: Request, res: Response): Promise<void> => {
  const file = path.basename(String(req.params.file ?? ""));
  res.sendFile(path.join(MEDIA_DIR, file), (err) => {
    if (err && !res.headersSent) res.status(404).send("media no encontrada");
  });
};
