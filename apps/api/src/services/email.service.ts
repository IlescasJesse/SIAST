/**
 * email.service.ts
 *
 * Envío de OTP por correo — alternativa a WhatsApp cuando el empleado no puede
 * recibir mensajes por teléfono (feedback staff 2026-08-12).
 *
 * Configuración via .env (SMTP genérico, compatible con cualquier proveedor):
 *   MAIL_HOST, MAIL_PORT, MAIL_SECURE, MAIL_USER, MAIL_PASS, MAIL_FROM
 *
 * Sin SMTP configurado (dev) → cae a modo CONSOLA, igual que whatsapp.service.ts.
 */

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

let transporter: Transporter | null = null;
let transporterFailed = false;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;
  if (transporterFailed) return null;

  const host = process.env.MAIL_HOST;
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_PASS;

  if (!host || !user || !pass) {
    transporterFailed = true;
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.MAIL_PORT ?? 587),
    secure: process.env.MAIL_SECURE === "true",
    auth: { user, pass },
  });
  return transporter;
}

/** Enmascara el correo: "juan.perez@oaxaca.gob.mx" → "j***z@oaxaca.gob.mx" */
export const maskEmail = (email: string): string => {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  if (local.length <= 2) return `${local[0] ?? "*"}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
};

export interface EnvioOtpResult {
  ok: boolean;
}

/**
 * Envía un código OTP por correo.
 *
 * Igual estrategia de resiliencia que whatsapp.service.ts: sin SMTP configurado
 * o si el envío falla, cae a modo consola en dev; en producción lanza 503.
 */
export async function enviarOtpEmail(
  email: string,
  codigo: string,
  nombre: string,
): Promise<EnvioOtpResult> {
  const t = getTransporter();

  if (t) {
    try {
      await t.sendMail({
        from: process.env.MAIL_FROM ?? process.env.MAIL_USER,
        to: email,
        subject: "SIAST — Código de acceso",
        text:
          `Hola ${nombre.split(" ")[0]}, tu código de acceso a SIAST es: ${codigo}\n\n` +
          `Válido por 10 minutos. No lo compartas.`,
        html:
          `<p>Hola ${nombre.split(" ")[0]}, tu código de acceso a <strong>SIAST</strong> es:</p>` +
          `<p style="font-size:28px;font-weight:700;letter-spacing:4px">${codigo}</p>` +
          `<p>Válido por 10 minutos. No lo compartas.</p>`,
      });
      console.log(`[Email] OTP enviado a ${maskEmail(email)}`);
      return { ok: true };
    } catch (err: any) {
      console.error(`[Email] Error al enviar OTP: ${err.message} — cayendo a modo consola`);
    }
  }

  if (process.env.NODE_ENV === "production") {
    throw Object.assign(new Error("Servicio de correo no disponible. Contacte soporte."), {
      status: 503,
    });
  }

  console.log("\n┌──────────────────────────────────────────────┐");
  console.log(`│  OTP CONSOLA (email) → ${maskEmail(email).padEnd(24)}│`);
  console.log(`│  Nombre: ${nombre.slice(0, 25).padEnd(25)}      │`);
  console.log(`│  Código: ${codigo}  (SMTP no configurado)     │`);
  console.log("└──────────────────────────────────────────────┘\n");

  return { ok: true };
}
