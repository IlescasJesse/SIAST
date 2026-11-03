/**
 * Doble de prueba (test double) del cliente Prisma.
 *
 * `apps/api/src/config/database.ts` reutiliza `globalThis.prisma` si ya existe
 * (patrón singleton de desarrollo). Este módulo coloca ahí un objeto en memoria
 * ANTES de que se carguen los servicios, de modo que las pruebas unitarias nunca
 * abren conexión con MySQL. Cada prueba reemplaza solo los métodos que necesita.
 */

type Fn = (...args: any[]) => any;
type Modelo = Record<string, Fn>;

const vacio = (): Modelo => ({
  findMany: async () => [],
  findFirst: async () => null,
  findUnique: async () => null,
  findUniqueOrThrow: async () => {
    throw new Error("No encontrado (doble)");
  },
  count: async () => 0,
  create: async ({ data }: any) => ({ id: 1, ...data }),
  createMany: async () => ({ count: 0 }),
  update: async ({ data }: any) => ({ id: 1, ...data }),
  updateMany: async () => ({ count: 0 }),
  delete: async () => ({}),
});

const MODELOS = [
  "ticket",
  "usuario",
  "empleado",
  "areaEdificio",
  "areaSoporte",
  "historialTicket",
  "notificacion",
  "procesoDefinicion",
  "pasoTicket",
  "otpToken",
  "sesion",
  "logAcceso",
] as const;

export const doble: Record<string, any> = {};

/** Restablece todos los modelos a su comportamiento por omisión (sin datos). */
export function reiniciarDoble(): void {
  for (const m of MODELOS) doble[m] = vacio();
  doble.$queryRaw = async () => [{ maximo: 0 }];
  doble.$transaction = async (ops: any) =>
    typeof ops === "function" ? ops(doble) : Promise.all(ops);
}

reiniciarDoble();
(globalThis as any).prisma = doble;

// Variables mínimas para importar módulos que las exigen al cargar.
process.env.JWT_SECRET ??= "clave-solo-para-pruebas-unitarias";
process.env.WA_ENABLED = "false";
process.env.SIRH_ENABLED = "false";
