import { prisma } from "../config/database.js";
import { enviarOtp, type EnvioOtpResult } from "./whatsapp.service.js";

const OTP_TTL_MINUTOS = 10;

/** Genera un código numérico de 6 dígitos */
const generarCodigo = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString();

/** Enmascara el teléfono: "9512345678" → "******5678" */
export const maskTelefono = (tel: string): string =>
  tel.slice(-4).padStart(tel.length, "*");

export interface SolicitarOtpResult {
  ok: true;
  hint: string; // teléfono enmascarado
  devCodigo?: string; // solo en dev
}

export interface NecesitaTelefonoResult {
  necesitaTelefono: true;
}

/**
 * Genera y envía un OTP al empleado.
 * Si el empleado no tiene teléfono registrado y se pasa `telefonoNuevo`,
 * lo registra antes de enviar (flujo de primer acceso).
 */
export const solicitarOtp = async (
  rfc: string,
  telefonoNuevo?: string,
): Promise<SolicitarOtpResult | NecesitaTelefonoResult> => {
  const empleado = await prisma.empleado.findUnique({
    where: { rfc, activo: true },
    select: { telefono: true, nombreCompleto: true },
  });

  if (!empleado) {
    throw Object.assign(new Error("RFC no encontrado en el sistema"), { status: 404 });
  }

  let telefono = empleado.telefono;

  // Primer acceso: registrar teléfono si se proporcionó
  if (!telefono && telefonoNuevo) {
    const limpio = telefonoNuevo.replace(/\D/g, "").slice(-10);
    if (limpio.length !== 10) {
      throw Object.assign(new Error("Número de celular inválido (10 dígitos)"), { status: 400 });
    }
    await prisma.empleado.update({
      where: { rfc },
      data: { telefono: limpio },
    });
    telefono = limpio;
  }

  // Sin teléfono y sin telefonoNuevo → indicar al frontend que debe pedirlo
  if (!telefono) {
    return { necesitaTelefono: true };
  }

  // Invalidar OTPs anteriores no usados del mismo RFC
  await prisma.otpToken.updateMany({
    where: { rfc, usado: false },
    data: { usado: true },
  });

  const codigo = generarCodigo();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTOS * 60 * 1000);

  await prisma.otpToken.create({ data: { rfc, codigo, expiresAt } });

  const envio: EnvioOtpResult = await enviarOtp(telefono, codigo, empleado.nombreCompleto);

  return {
    ok: true,
    hint: maskTelefono(telefono),
    ...(envio.devCodigo ? { devCodigo: envio.devCodigo } : {}),
  };
};

/** Verifica el código y devuelve el RFC del empleado si es correcto */
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
