import bcrypt from "bcrypt";
import { prisma } from "../config/database.js";
import { signToken } from "../config/jwt.js";
import { LABEL_PISO } from "@stf/shared";
import { fetchEmpleadoByRfc } from "./sirh.service.js";
import { crearSesion, registrarAcceso } from "./sesiones.service.js";

const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i;
const EMPLEADO_JWT_EXPIRES_IN = process.env.EMPLEADO_JWT_EXPIRES_IN ?? "30d";
const STAFF_JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "8h";

function msFromExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([hdm])$/);
  if (!match) return 8 * 60 * 60 * 1000;
  const n = parseInt(match[1], 10);
  const unit = match[2];
  if (unit === "h") return n * 60 * 60 * 1000;
  if (unit === "d") return n * 24 * 60 * 60 * 1000;
  if (unit === "m") return n * 60 * 1000;
  return 8 * 60 * 60 * 1000;
}

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

export const loginRFC = async (rfc: string, meta: RequestMeta = {}) => {
  if (!RFC_REGEX.test(rfc.toUpperCase())) {
    throw Object.assign(new Error("Formato de RFC inválido"), { status: 400 });
  }

  const rfcUp = rfc.toUpperCase();

  let empleado = await prisma.empleado.findUnique({
    where: { rfc: rfcUp, activo: true },
    include: { area: true },
  });

  if (!empleado) {
    const importado = await fetchEmpleadoByRfc(rfcUp);
    if (importado) {
      empleado = await prisma.empleado.findUnique({
        where: { rfc: rfcUp, activo: true },
        include: { area: true },
      });
    }
  }

  if (!empleado) {
    await registrarAcceso({ tipo: "EMPLEADO", identifier: rfcUp, resultado: "FAIL_NOT_FOUND", ...meta });
    throw Object.assign(new Error("RFC no encontrado en el sistema"), { status: 404 });
  }

  const ticketsActivos = await prisma.ticket.count({
    where: { empleadoRfc: empleado.rfc, activo: true, estado: { notIn: ["RESUELTO", "CANCELADO"] } },
  });

  const expiresInMs = msFromExpiry(EMPLEADO_JWT_EXPIRES_IN);
  const jti = await crearSesion({ empleadoRfc: rfcUp, expiresInMs, ...meta });

  const token = signToken(
    { id: empleado.id, rol: "EMPLEADO", rfc: empleado.rfc, nombre: empleado.nombreCompleto, jti },
    EMPLEADO_JWT_EXPIRES_IN,
  );

  await registrarAcceso({ tipo: "EMPLEADO", identifier: rfcUp, resultado: "OK", empleadoRfc: rfcUp, ...meta });

  return {
    token,
    user: {
      id: empleado.id,
      rfc: empleado.rfc,
      nombre: empleado.nombre,
      apellidos: empleado.apellidos,
      nombreCompleto: empleado.nombreCompleto,
      area: empleado.area.label,
      areaId: empleado.areaId,
      piso: empleado.piso,
      floor: empleado.area.floor,
      floorLabel: LABEL_PISO[empleado.piso],
      adscripcion: empleado.adscripcion ?? empleado.departamento ?? null,
      departamento: empleado.departamento ?? null,
      puesto: empleado.puesto ?? null,
      rol: "EMPLEADO" as const,
      ticketsActivos,
    },
  };
};

export const loginStaff = async (usuario: string, password: string, meta: RequestMeta = {}) => {
  const user = await prisma.usuario.findUnique({ where: { usuario } });

  if (!user) {
    await registrarAcceso({ tipo: "STAFF", identifier: usuario, resultado: "FAIL_NOT_FOUND", ...meta });
    throw Object.assign(new Error("Credenciales incorrectas"), { status: 401 });
  }

  if (!user.activo) {
    await registrarAcceso({ tipo: "STAFF", identifier: usuario, resultado: "FAIL_INACTIVE", usuarioId: user.id, ...meta });
    throw Object.assign(new Error("Credenciales incorrectas"), { status: 401 });
  }

  const passwordOk = await bcrypt.compare(password, user.password);
  if (!passwordOk) {
    await registrarAcceso({ tipo: "STAFF", identifier: usuario, resultado: "FAIL_PASSWORD", usuarioId: user.id, ...meta });
    throw Object.assign(new Error("Credenciales incorrectas"), { status: 401 });
  }

  const expiresInMs = msFromExpiry(STAFF_JWT_EXPIRES_IN);
  const jti = await crearSesion({ usuarioId: user.id, expiresInMs, ...meta });

  const token = signToken({
    id: user.id,
    rol: user.rol,
    usuario: user.usuario,
    nombre: `${user.nombre} ${user.apellidos}`,
    jti,
  });

  await registrarAcceso({ tipo: "STAFF", identifier: usuario, resultado: "OK", usuarioId: user.id, ...meta });

  return {
    token,
    user: {
      id: user.id,
      usuario: user.usuario,
      nombre: user.nombre,
      apellidos: user.apellidos,
      email: user.email,
      rol: user.rol,
    },
  };
};
