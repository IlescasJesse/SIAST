import { prisma } from "../config/database.js";
import { enviarOtp, type EnvioOtpResult } from "./whatsapp.service.js";
import { fetchEmpleadoByRfc, updateTelefonoEnSirh } from "./sirh.service.js";

const OTP_TTL_MINUTOS = 10;

/** Genera un código numérico de 6 dígitos */
const generarCodigo = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString();

/** Enmascara el teléfono: "9512345678" → "******5678" */
export const maskTelefono = (tel: string): string =>
  tel.slice(-4).padStart(tel.length, "*");

// ─────────────────────────────────────────────────────────────────────────────
// Tipos de respuesta
// ─────────────────────────────────────────────────────────────────────────────

export interface SolicitarOtpResult {
  ok: true;
  hint: string;
  devCodigo?: string;
}

/** Primer acceso: empleado SÍ tiene teléfono en DB → pedir confirmación */
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
  telefono: string,
  nombreCompleto: string,
): Promise<SolicitarOtpResult> {
  // Invalidar OTPs anteriores
  await prisma.otpToken.updateMany({
    where: { rfc, usado: false },
    data: { usado: true },
  });

  const codigo = generarCodigo();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTOS * 60 * 1000);

  await prisma.otpToken.create({ data: { rfc, codigo, expiresAt } });

  const envio: EnvioOtpResult = await enviarOtp(telefono, codigo, nombreCompleto);

  return {
    ok: true,
    hint: maskTelefono(telefono),
    ...(envio.devCodigo ? { devCodigo: envio.devCodigo } : {}),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// solicitar-otp
//
// Flujo primer acceso:
//   1. Sin teléfono en DB         → { necesitaTelefono: true }
//   2. Con teléfono, sin confirmar → { necesitaConfirmarTelefono: true, telefonoCensurado }
//
// Flujo normal (primerAcceso=false o ya confirmó):
//   → Genera y envía OTP directamente
//
// Cuando se pasa `telefono` en el body:
//   - Si es primer acceso SIN teléfono previo → registra y envía OTP
//   - Si es primer acceso CON teléfono previo diferente → actualiza SIAST + SIRH, envía OTP
//   - Si el teléfono es igual al que ya tenemos → envía OTP sin tocar SIRH
// ─────────────────────────────────────────────────────────────────────────────

export const solicitarOtp = async (
  rfc: string,
  telefonoNuevo?: string,
): Promise<SolicitarOtpResult | NecesitaConfirmarTelefonoResult | NecesitaTelefonoResult> => {
  // Buscar empleado en DB local
  let empleado = await prisma.empleado.findUnique({
    where: { rfc, activo: true },
    select: { telefono: true, nombreCompleto: true, primerAcceso: true, sirhId: true },
  });

  // Si no está en DB, intentar importar del SIRH al vuelo
  if (!empleado) {
    const importado = await fetchEmpleadoByRfc(rfc).catch(() => false);
    if (importado) {
      empleado = await prisma.empleado.findUnique({
        where: { rfc, activo: true },
        select: { telefono: true, nombreCompleto: true, primerAcceso: true, sirhId: true },
      });
    }
  }

  if (!empleado) {
    throw Object.assign(new Error("RFC no encontrado en el sistema"), { status: 404 });
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
        updateTelefonoEnSirh(empleado.sirhId, limpio).catch((e) =>
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

    return generarYEnviarOtp(rfc, telefonoFinal, empleado.nombreCompleto);
  }

  // ── Caso: primer acceso (primerAcceso=true) sin teléfono proporcionado ────
  if (empleado.primerAcceso) {
    if (!empleado.telefono) {
      // Sin teléfono → pedir que lo registre
      return { necesitaTelefono: true };
    }
    // Tiene teléfono → pedir que confirme o cambie
    return {
      necesitaConfirmarTelefono: true,
      telefonoCensurado: maskTelefono(empleado.telefono),
    };
  }

  // ── Caso: acceso normal (ya confirmó antes) ───────────────────────────────
  if (!empleado.telefono) {
    // Edge case: primerAcceso=false pero sin teléfono (datos corruptos)
    return { necesitaTelefono: true };
  }

  // Actualizar fecha último acceso
  await prisma.empleado.update({
    where: { rfc },
    data: { fechaUltimoAcceso: new Date() },
  });

  return generarYEnviarOtp(rfc, empleado.telefono, empleado.nombreCompleto);
};

// ─────────────────────────────────────────────────────────────────────────────
// verificar-otp
// ─────────────────────────────────────────────────────────────────────────────

export const verificarOtp = async (rfc: string, codigo: string): Promise<void> => {
  const otp = await prisma.otpToken.findFirst({
    where: {
      rfc,
      codigo,
      usado: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) {
    throw Object.assign(
      new Error("Código incorrecto o expirado"),
      { status: 401 },
    );
  }

  await prisma.otpToken.update({ where: { id: otp.id }, data: { usado: true } });
};
