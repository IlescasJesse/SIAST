import type { CrearNovedad } from "@stf/shared";
import { prisma } from "../config/database.js";
import { getIo } from "./notificaciones.service.js";

// Audiencias que ve cada usuario: el empleado (incluye honorarios) ve TODOS + EMPLEADOS;
// el staff ve TODOS + STAFF.
const audienciasPara = (rol: string) =>
  rol === "EMPLEADO" ? (["TODOS", "EMPLEADOS"] as const) : (["TODOS", "STAFF"] as const);

export const listarParaUsuario = async (rol: string) => {
  return prisma.novedad.findMany({
    where: { activo: true, audiencia: { in: [...audienciasPara(rol)] } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
};

export const listarTodas = async () => {
  return prisma.novedad.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
};

export const publicar = async (datos: CrearNovedad) => {
  const novedad = await prisma.novedad.create({ data: datos });
  // Se emite a todos los navegadores; cada cliente filtra por su audiencia.
  getIo()?.emit("sistema:novedad", novedad);
  console.log(`[Novedad] #${novedad.id} publicada (${novedad.audiencia}): ${novedad.titulo}`);
  return novedad;
};

export const retirar = async (id: number) => {
  const r = await prisma.novedad.updateMany({ where: { id }, data: { activo: false } });
  return r.count > 0;
};
