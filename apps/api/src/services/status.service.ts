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
  preview?: string; // texto/ascii/markdown para comparar opciones (situacional)
  image?: string; // URL de screenshot (ej. /api/orchestrator/media/foo.png)
}

export interface OrchestratorPhase {
  id?: string;
  title: string;
  status?: "pending" | "active" | "done";
  detail?: string;
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

export type TaskStatus = "pending" | "active" | "complete" | "blocked";

export interface OrchestratorTask {
  id: number | string;
  name: string;
  agent?: string;
  model?: string;
  status?: TaskStatus;
  progress?: number;
  action?: string;
  depends?: (number | string)[];
}

export interface OrchestratorStatus {
  updatedAt: string | null;
  mission: string;
  tasks: unknown[];
  log: unknown[];
  questions: OrchestratorQuestion[];
  commands?: OrchestratorCommand[];
  chat?: ChatMessage[];
  phases?: OrchestratorPhase[];
}

export const EMPTY_STATUS: OrchestratorStatus = {
  updatedAt: null,
  mission: "",
  tasks: [],
  log: [],
  questions: [],
  commands: [],
  chat: [],
  phases: [],
};

async function _readStatusFromDisk(): Promise<OrchestratorStatus> {
  try {
    const raw = await fs.readFile(STATUS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<OrchestratorStatus>;
    return { ...EMPTY_STATUS, ...parsed };
  } catch {
    return { ...EMPTY_STATUS };
  }
}

export async function readStatus(): Promise<OrchestratorStatus> {
  return _readStatusFromDisk();
}

// Cola de operaciones: serializa escrituras y read-modify-write para que
// los tres writers (/answer, /action, /chat) no se pisen. updateStatus hace
// el ciclo leer→mutar→escribir DENTRO de la cola, así cada operación ve el
// resultado de la anterior (sirve para cualquier campo: chat, log, etc.).
let opChain: Promise<void> = Promise.resolve();

export function writeStatus(status: OrchestratorStatus): Promise<void> {
  const run = async (): Promise<void> => {
    await fs.writeFile(STATUS_FILE, JSON.stringify(status, null, 2), "utf-8");
  };
  opChain = opChain.then(run, run);
  return opChain;
}

export function updateStatus(
  mutator: (s: OrchestratorStatus) => void | OrchestratorStatus,
): Promise<OrchestratorStatus> {
  let result: OrchestratorStatus = EMPTY_STATUS;
  const run = async (): Promise<void> => {
    const current = await _readStatusFromDisk();
    const mutated = mutator(current) ?? current;
    result = mutated;
    await fs.writeFile(STATUS_FILE, JSON.stringify(mutated, null, 2), "utf-8");
  };
  opChain = opChain.then(run, run);
  return opChain.then(() => result);
}
