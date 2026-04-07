import bcrypt from "bcrypt";
import { prisma } from "../config/database.js";
import { signToken } from "../config/jwt.js";
import { LABEL_PISO } from "@stf/shared";
import { fetchEmpleadoByRfc } from "./sirh.service.js";

const RFC_REGEX = /^[A-Z]{4}\d{6}[A-Z0-9]{3}$/;

export const loginRFC = async (rfc: string) => {
  if (!RFC_REGEX.test(rfc.toUpperCase())) {
    throw Object.assign(new Error("Formato de RFC inválido"), { status: 400 });
  }

  const rfcUp = rfc.toUpperCase();

  let empleado = await prisma.empleado.findUnique({
    where: { rfc: rfcUp, activo: true },
    include: { area: true },
  });

  // Si no existe en DB local, intentar obtenerlo de SIRH antes de rechazar
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
    throw Object.assign(new Error("RFC no encontrado en el sistema"), { status: 404 });
  }

  const ticketsActivos = await prisma.ticket.count({
    where: {
      empleadoRfc: empleado.rfc,
      activo: true,
      estado: { notIn: ["RESUELTO", "CANCELADO"] },
    },
  });

  const token = signToken({
    id: empleado.id,
    rol: "EMPLEADO",
    rfc: empleado.rfc,
    nombre: empleado.nombreCompleto,
  });

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

export const loginStaff = async (usuario: string, password: string) => {
  const user = await prisma.usuario.findUnique({
    where: { usuario, activo: true },
  });

  if (!user) {
    throw Object.assign(new Error("Credenciales incorrectas"), { status: 401 });
  }

  const passwordOk = await bcrypt.compare(password, user.password);
  if (!passwordOk) {
    throw Object.assign(new Error("Credenciales incorrectas"), { status: 401 });
  }

  const token = signToken({
    id: user.id,
    rol: user.rol,
    usuario: user.usuario,
    nombre: `${user.nombre} ${user.apellidos}`,
  });

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
