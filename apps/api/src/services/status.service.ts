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

// Mutex simple: encadena cada escritura tras la anterior para evitar que dos
// writers (/answer, /action, /chat) se pisen al leer-modificar-escribir.
// Cada write re-lee el estado actual del disco (dentro de la cadena) para
// que escrituras concurrentes no se sobreescriban mutuamente.
let writeChain: Promise<void> = Promise.resolve();

export function writeStatus(status: OrchestratorStatus): Promise<void> {
  const incomingChat = status.chat ?? [];
  const run = async (): Promise<void> => {
    // Re-read current state from disk inside the mutex so concurrent
    // read-modify-write callers don't overwrite each other.
    const current = await _readStatusFromDisk();
    const currentChat = current.chat ?? [];
    // Merge: keep existing chat messages, then append any new ones from
    // the incoming status that aren't already in current.
    const existingTexts = new Set(currentChat.map((m) => m.ts + m.text + m.role));
    const newMessages = incomingChat.filter((m) => !existingTexts.has(m.ts + m.text + m.role));
    const merged: OrchestratorStatus = {
      ...status,
      chat: [...currentChat, ...newMessages],
    };
    await fs.writeFile(STATUS_FILE, JSON.stringify(merged, null, 2), "utf-8");
  };
  writeChain = writeChain.then(run, run);
  return writeChain;
}
