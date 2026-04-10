/**
 * whatsapp.service.ts
 *
 * Envío de OTP por WhatsApp usando whatsapp-web.js.
 *
 * Primer arranque:
 *   - Imprime un QR en consola → escanear con WhatsApp del número de la oficina
 *   - La sesión queda guardada en .wwebjs_auth/ (no vuelve a pedir QR)
 *
 * En desarrollo sin WhatsApp conectado:
 *   - Si el cliente no está listo en 30s, cae al modo CONSOLE (imprime código en log)
 *   - El código también se devuelve en la respuesta HTTP para facilitar pruebas
 */

import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Tipos mínimos para evitar @types/whatsapp-web.js ─────────────────────────
interface WWebClient {
  on(event: string, cb: (...args: any[]) => void): void;
  initialize(): Promise<void>;
  sendMessage(to: string, msg: string): Promise<void>;
  info?: { wid?: unknown };
}

// ── Estado del cliente ────────────────────────────────────────────────────────

type ClientState = "initializing" | "ready" | "failed";

let client: WWebClient | null = null;
let clientState: ClientState = "initializing";

// ── Inicialización (se llama desde index.ts al arrancar) ──────────────────────

export function initWhatsApp(): void {
  let wweb: any;
  try {
    wweb = require("whatsapp-web.js");
  } catch {
    console.warn("[WhatsApp] whatsapp-web.js no instalado — modo CONSOLA activo");
    clientState = "failed";
    return;
  }

  let qrcodeTerminal: any;
  try {
    qrcodeTerminal = require("qrcode-terminal");
  } catch {
    qrcodeTerminal = null;
  }

  const authPath = path.resolve(__dirname, "../../../../.wwebjs_auth");

  // Rutas comunes de Chrome en Windows — usa el que encuentre primero
  const chromePaths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    process.env.CHROME_PATH ?? "",
  ].filter(Boolean);

  const executablePath = chromePaths.find((p) => {
    try { return require("fs").existsSync(p); } catch { return false; }
  });

  const wClient: WWebClient = new wweb.Client({
    authStrategy: new wweb.LocalAuth({ dataPath: authPath }),
    puppeteer: {
      headless: true,
      executablePath: executablePath || undefined,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    },
  });

  wClient.on("qr", (qr: string) => {
    console.log("\n╔════════════════════════════════════════════╗");
    console.log("║  SIAST — WhatsApp: escanea el QR siguiente  ║");
    console.log("╚════════════════════════════════════════════╝\n");
    if (qrcodeTerminal) {
      qrcodeTerminal.generate(qr, { small: true });
    } else {
      console.log("QR (raw):", qr);
    }
  });

  wClient.on("ready", () => {
    clientState = "ready";
    console.log("[WhatsApp] Cliente listo ✓");
  });

  wClient.on("auth_failure", (msg: string) => {
    clientState = "failed";
    console.error("[WhatsApp] Fallo de autenticación:", msg);
  });

  wClient.on("disconnected", (reason: string) => {
    clientState = "failed";
    console.warn("[WhatsApp] Desconectado:", reason);
  });

  client = wClient;

  // No bloquea el arranque del servidor
  wClient.initialize().catch((err: Error) => {
    clientState = "failed";
    console.error("[WhatsApp] Error al inicializar:", err.message);
  });

  // Si en 30s no está listo → marcar como fallido (el servidor ya arrancó)
  setTimeout(() => {
    if (clientState === "initializing") {
      clientState = "failed";
      console.warn("[WhatsApp] Timeout 30s — modo CONSOLA activo para OTP");
    }
  }, 30_000);
}

// ── Tipos públicos ────────────────────────────────────────────────────────────

export interface EnvioOtpResult {
  ok: boolean;
  /** Solo cuando WhatsApp no está disponible — el código en claro para consola */
  devCodigo?: string;
}

// ── Envío ─────────────────────────────────────────────────────────────────────

/**
 * Envía un código OTP por WhatsApp.
 * Si el cliente no está listo cae a modo consola (útil en dev).
 */
export async function enviarOtp(
  telefono: string,
  codigo: string,
  nombre: string,
): Promise<EnvioOtpResult> {
  const mensaje =
    `*SIAST* — Secretaría de Finanzas Oaxaca\n` +
    `Hola ${nombre.split(" ")[0]}, tu código de acceso es:\n\n` +
    `*${codigo}*\n\n` +
    `Válido por 10 minutos. No lo compartas.`;

  // ── Modo WhatsApp conectado ───────────────────────────────────────────────
  if (clientState === "ready" && client) {
    const numberId = await (client as any).getNumberId(`52${telefono}`);
    if (!numberId) {
      throw Object.assign(
        new Error("El número de celular no tiene WhatsApp activo. Verifica el número e intenta de nuevo."),
        { status: 422 },
      );
    }
    await client.sendMessage(numberId._serialized, mensaje);
    return { ok: true };
  }

  // ── Modo consola (fallback dev) ───────────────────────────────────────────
  console.log("\n┌─────────────────────────────────────────┐");
  console.log(`│  OTP CONSOLA → ******${telefono.slice(-4)}            │`);
  console.log(`│  Código: ${codigo}                          │`);
  console.log("└─────────────────────────────────────────┘\n");

  const isDev = process.env.NODE_ENV !== "production";
  return { ok: true, devCodigo: isDev ? codigo : undefined };
}
