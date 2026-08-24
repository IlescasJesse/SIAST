import { randomInt } from "crypto";
import bcrypt from "bcrypt";
import { prisma } from "../config/database.js";
import { enviarOtp } from "./whatsapp.service.js";
import { enviarOtpEmail, maskEmail } from "./email.service.js";
import { fetchEmpleadoByRfc, updateTelefonoEnSirh, updateEmailEnSirh } from "./sirh.service.js";

const OTP_TTL_MINUTOS = 10;
const OTP_BCRYPT_ROUNDS = 10;

/** Canal de entrega del OTP — "email" es alternativa cuando WhatsApp no es viable (feedback staff 2026-08-12) */
export type CanalOtp = "whatsapp" | "email";

/** Genera un código numérico de 6 dígitos usando CSPRNG */
const generarCodigo = (): string => randomInt(100000, 999999).toString();

/** Enmascara el teléfono: "9512345678" → "******5678" */
export const maskTelefono = (tel: string): string => tel.slice(-4).padStart(tel.length, "*");

// ─────────────────────────────────────────────────────────────────────────────
// Tipos de respuesta
// ─────────────────────────────────────────────────────────────────────────────

export interface SolicitarOtpResult {
  ok: true;
  hint: string;
  canal: CanalOtp;
}

/** Primer acceso: empleado SÍ tiene correo en DB → pedir confirmación (prioridad sobre teléfono) */
export interface NecesitaConfirmarEmailResult {
  necesitaConfirmarEmail: true;
  emailCensurado: string; // ej: "j***z@dominio.com"
}

/** Primer acceso: empleado SÍ tiene teléfono en DB pero no correo → pedir confirmación */
export interface NecesitaConfirmarTelefonoResult {
  necesitaConfirmarTelefono: true;
  telefonoCensurado: string; // ej: "******5678"
}

/** Primer acceso sin teléfono: pedir que lo registre */
export interface NecesitaTelefonoResult {
  necesitaTelefono: true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: enviar OTP y marcar último acceso
// ─────────────────────────────────────────────────────────────────────────────

async function generarYEnviarOtp(
  rfc: string,
  destino: string,
  nombreCompleto: string,
  canal: CanalOtp,
): Promise<SolicitarOtpResult> {
  // Invalidar OTPs anteriores
  await prisma.otpToken.updateMany({
    where: { rfc, usado: false },
    data: { usado: true },
  });

  const codigo = generarCodigo();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTOS * 60 * 1000);

  // SEC: solo se persiste el hash — el código en claro vive únicamente
  // el tiempo del envío y nunca regresa en la respuesta HTTP.
  const codigoHash = await bcrypt.hash(codigo, OTP_BCRYPT_ROUNDS);
  await prisma.otpToken.create({ data: { rfc, codigo: codigoHash, expiresAt } });

  if (canal === "email") {
    await enviarOtpEmail(destino, codigo, nombreCompleto);
    return { ok: true, hint: maskEmail(destino), canal };
  }

  await enviarOtp(destino, codigo, nombreCompleto);
  return { ok: true, hint: maskTelefono(destino), canal };
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─────────────────────────────────────────────────────────────────────────────
// solicitar-otp
//
// Prioridad de canal (feedback staff 2026-08-19): correo primero, WhatsApp como
// alternativa — tanto en primer acceso como en accesos posteriores.
//
// Flujo primer acceso:
//   1. Con correo en DB           → { necesitaConfirmarEmail: true, emailCensurado }
//   2. Sin correo, con teléfono   → { necesitaConfirmarTelefono: true, telefonoCensurado }
//   3. Sin correo ni teléfono     → { necesitaTelefono: true }
//
// Flujo normal (primerAcceso=false o ya confirmó):
//   → Envía por `canal` si se especifica explícito; si no, correo si hay
//     correo registrado, si no WhatsApp.
//
// Cuando se pasa `emailNuevo`:
//   - "__CONFIRMAR__" = acepta el correo que ya tenemos en DB
//   - cualquier otro valor = lo valida y actualiza en SIAST + SIRH (si cambió y hay sirhId)
//
// Cuando se pasa `telefonoNuevo` (igual que antes):
//   - Si es primer acceso SIN teléfono previo → registra y envía OTP
//   - Si es primer acceso CON teléfono previo diferente → actualiza SIAST + SIRH, envía OTP
//   - Si el teléfono es igual al que ya tenemos → envía OTP sin tocar SIRH
// ─────────────────────────────────────────────────────────────────────────────

export const solicitarOtp = async (
  rfc: string,
  telefonoNuevo?: string,
  canal?: CanalOtp,
  emailNuevo?: string,
): Promise<
  | SolicitarOtpResult
  | NecesitaConfirmarEmailResult
  | NecesitaConfirmarTelefonoResult
  | NecesitaTelefonoResult
> => {
  // Buscar empleado en DB local
  let empleado = await prisma.empleado.findUnique({
    where: { rfc, activo: true },
    select: { telefono: true, email: true, nombreCompleto: true, primerAcceso: true, sirhId: true },
  });

  // Si no está en DB, intentar importar del SIRH al vuelo
  if (!empleado) {
    const importado = await fetchEmpleadoByRfc(rfc).catch(() => false);
    if (importado) {
      empleado = await prisma.empleado.findUnique({
        where: { rfc, activo: true },
        select: {
          telefono: true,
          email: true,
          nombreCompleto: true,
          primerAcceso: true,
          sirhId: true,
        },
      });
    }
  }

  if (!empleado) {
    throw Object.assign(new Error("RFC no encontrado en el sistema"), { status: 404 });
  }

  // ── Caso: se proporcionó un correo (confirmación o cambio) — prioridad ────
  if (emailNuevo) {
    const esConfirmacion = emailNuevo === "__CONFIRMAR__";
    let emailFinal = empleado.email;

    if (!esConfirmacion) {
      const limpio = emailNuevo.trim().toLowerCase();
      if (!EMAIL_REGEX.test(limpio)) {
        throw Object.assign(new Error("Correo inválido"), { status: 400 });
      }

      const esDiferente = empleado.email !== limpio;

      await prisma.empleado.update({ where: { rfc }, data: { email: limpio } });

      // Si cambió y tenemos sirhId → retroalimentar SIRH en background
      if (esDiferente && empleado.sirhId) {
        updateEmailEnSirh(rfc, empleado.sirhId, limpio).catch((e) =>
          console.warn("[OTP] No se pudo actualizar EMAIL en SIRH:", e.message),
        );
      }

      emailFinal = limpio;
    }

    if (!emailFinal) {
      throw Object.assign(new Error("No hay correo registrado"), { status: 422 });
    }

    // Marcar primer acceso completado
    await prisma.empleado.update({
      where: { rfc },
      data: { primerAcceso: false, fechaUltimoAcceso: new Date() },
    });

    return generarYEnviarOtp(rfc, emailFinal, empleado.nombreCompleto, "email");
  }

  // ── Caso: se proporcionó un teléfono (confirmación o registro) ────────────
  if (telefonoNuevo) {
    // "__CONFIRMAR__" = el empleado acepta el teléfono que ya tenemos en DB
    const esConfirmacion = telefonoNuevo === "__CONFIRMAR__";

    let telefonoFinal = empleado.telefono;

    if (!esConfirmacion) {
      const limpio = telefonoNuevo.replace(/\D/g, "").slice(-10);
      if (limpio.length !== 10) {
        throw Object.assign(new Error("Número de celular inválido (10 dígitos)"), { status: 400 });
      }

      const esDiferente = empleado.telefono !== limpio;

      // Actualizar teléfono en SIAST
      await prisma.empleado.update({
        where: { rfc },
        data: { telefono: limpio },
      });

      // Si cambió y tenemos sirhId → retroalimentar SIRH en background
      if (esDiferente && empleado.sirhId) {
        updateTelefonoEnSirh(rfc, empleado.sirhId, limpio).catch((e) =>
          console.warn("[OTP] No se pudo actualizar SIRH:", e.message),
        );
      }

      telefonoFinal = limpio;
    }

    if (!telefonoFinal) {
      throw Object.assign(new Error("No hay teléfono registrado"), { status: 422 });
    }

    // Marcar primer acceso completado
    await prisma.empleado.update({
      where: { rfc },
      data: { primerAcceso: false, fechaUltimoAcceso: new Date() },
    });

    // El registro/confirmación de teléfono siempre envía por WhatsApp — es el
    // canal que se está registrando en este paso.
    return generarYEnviarOtp(rfc, telefonoFinal, empleado.nombreCompleto, "whatsapp");
  }

  // ── Caso: primer acceso (primerAcceso=true) sin canal confirmado aún ──────
  // Prioridad: correo > teléfono.
  if (empleado.primerAcceso) {
    if (empleado.email) {
      return { necesitaConfirmarEmail: true, emailCensurado: maskEmail(empleado.email) };
    }
    if (!empleado.telefono) {
      // Ni correo ni teléfono → pedir que registre uno (el único canal disponible)
      return { necesitaTelefono: true };
    }
    return {
      necesitaConfirmarTelefono: true,
      telefonoCensurado: maskTelefono(empleado.telefono),
    };
  }

  // ── Caso: acceso normal (ya confirmó antes) ───────────────────────────────
  // canal explícito (botón "cambiar canal" o reenviar) fuerza ese canal; sin
  // canal explícito, prioridad correo > WhatsApp.
  const canalEfectivo: CanalOtp = canal ?? (empleado.email ? "email" : "whatsapp");

  if (canalEfectivo === "email") {
    if (!empleado.email) {
      throw Object.assign(new Error("No hay correo registrado para este empleado"), {
        status: 422,
      });
    }
    await prisma.empleado.update({ where: { rfc }, data: { fechaUltimoAcceso: new Date() } });
    return generarYEnviarOtp(rfc, empleado.email, empleado.nombreCompleto, "email");
  }

  if (!empleado.telefono) {
    if (canal === "whatsapp") {
      // Se pidió WhatsApp explícito (botón "cambiar canal") — error claro en vez
      // de reabrir el flujo de registro de teléfono a media sesión.
      throw Object.assign(new Error("No hay teléfono registrado para WhatsApp"), {
        status: 422,
      });
    }
    // Auto-selección sin correo ni teléfono (datos corruptos): pedir registro
    return { necesitaTelefono: true };
  }

  await prisma.empleado.update({ where: { rfc }, data: { fechaUltimoAcceso: new Date() } });
  return generarYEnviarOtp(rfc, empleado.telefono, empleado.nombreCompleto, "whatsapp");
};

// ─────────────────────────────────────────────────────────────────────────────
// Preferencia de notificaciones por WhatsApp (Perfil) — feedback staff 2026-08-19
//
// Activar requiere teléfono confirmado (doble captura en el frontend); desactivar
// no toca el teléfono — sigue disponible como canal de OTP.
// ─────────────────────────────────────────────────────────────────────────────

export interface NotificacionesWhatsappResult {
  telefono: string | null;
  notificacionesWhatsapp: boolean;
}

export const actualizarNotificacionesWhatsapp = async (
  rfc: string,
  enabled: boolean,
  telefonoNuevo?: string,
): Promise<NotificacionesWhatsappResult> => {
  const empleado = await prisma.empleado.findUnique({
    where: { rfc, activo: true },
    select: { telefono: true, sirhId: true },
  });
  if (!empleado) throw Object.assign(new Error("Empleado no encontrado"), { status: 404 });

  if (!enabled) {
    await prisma.empleado.update({ where: { rfc }, data: { notificacionesWhatsapp: false } });
    return { telefono: empleado.telefono, notificacionesWhatsapp: false };
  }

  // Activar: requiere teléfono (el que ya tenía, o uno nuevo confirmado en el formulario)
  let telefonoFinal = empleado.telefono;
  if (telefonoNuevo) {
    const limpio = telefonoNuevo.replace(/\D/g, "").slice(-10);
    if (limpio.length !== 10) {
      throw Object.assign(new Error("Número de celular inválido (10 dígitos)"), { status: 400 });
    }
    const esDiferente = empleado.telefono !== limpio;
    await prisma.empleado.update({ where: { rfc }, data: { telefono: limpio } });
    if (esDiferente && empleado.sirhId) {
      updateTelefonoEnSirh(rfc, empleado.sirhId, limpio).catch((e) =>
        console.warn("[Perfil] No se pudo actualizar SIRH:", e.message),
      );
    }
    telefonoFinal = limpio;
  }

  if (!telefonoFinal) {
    throw Object.assign(
      new Error("Registra un número de celular para activar las notificaciones por WhatsApp"),
      { status: 422 },
    );
  }

  await prisma.empleado.update({ where: { rfc }, data: { notificacionesWhatsapp: true } });
  return { telefono: telefonoFinal, notificacionesWhatsapp: true };
};

// ─────────────────────────────────────────────────────────────────────────────
// verificar-otp
// ─────────────────────────────────────────────────────────────────────────────

export const verificarOtp = async (rfc: string, codigo: string): Promise<void> => {
  // Solo puede existir un token vigente por RFC (se invalidan al generar uno nuevo)
  const otp = await prisma.otpToken.findFirst({
    where: {
      rfc,
      usado: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  // bcrypt.compare es timing-safe; el hash dummy evita revelar si existe token vigente
  const hashAComparar =
    otp?.codigo ?? "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv";
  const coincide = await bcrypt.compare(codigo, hashAComparar);

  if (!otp || !coincide) {
    throw Object.assign(new Error("Código incorrecto o expirado"), { status: 401 });
  }

  await prisma.otpToken.update({ where: { id: otp.id }, data: { usado: true } });
};
