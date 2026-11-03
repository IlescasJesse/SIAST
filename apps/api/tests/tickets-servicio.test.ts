/**
 * Pruebas unitarias — Servicio de solicitudes (tickets.service.ts) y alcance por rol
 * (alcance.service.ts). La base de datos se sustituye por un doble en memoria.
 */
import { doble, reiniciarDoble } from "./helpers/prisma-doble.ts";
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

const tickets = await import("../src/services/tickets.service.ts");
const { alcanceLecturaTickets } = await import("../src/services/alcance.service.ts");

const ADMIN = { id: 1, rol: "ADMIN", nombre: "Administrador" } as any;
const MESA = { id: 2, rol: "MESA_AYUDA", nombre: "Mesa de Ayuda" } as any;
const EMPLEADO = { id: 0, rol: "EMPLEADO", nombre: "Juana Pérez", rfc: "PEPJ800101AB1" } as any;
const TECNICO = { id: 5, rol: "TECNICO_TI", nombre: "Técnico TI" } as any;

const solicitud = {
  asunto: "Sin acceso a internet",
  descripcion: "El equipo no navega desde la mañana.",
  categoria: "TECNOLOGIAS",
  subcategoria: "SISTEMAS_INSTITUCIONALES",
  ubicacionAreaId: "dir_admin",
  rfcSolicitante: "PEPJ800101AB1",
};

/** Configura el doble para un alta exitosa y devuelve lo que se escribió. */
function prepararAlta(maximoFolio = 22) {
  const escrito: { tickets: any[]; historial: any[] } = { tickets: [], historial: [] };
  doble.usuario.findUnique = async () => ({ id: ADMIN.id });
  doble.areaEdificio.findUnique = async () => ({ id: "dir_admin", piso: "NIVEL_1", label: "DA" });
  doble.$queryRaw = async () => [{ maximo: maximoFolio }];
  doble.ticket.create = async ({ data }: any) => {
    escrito.tickets.push(data);
    return { id: 100, ...data };
  };
  doble.historialTicket.create = async ({ data }: any) => escrito.historial.push(data);
  return escrito;
}

beforeEach(() => reiniciarDoble());

describe("crearTicket — levantamiento de solicitudes", () => {
  it("genera folio consecutivo con prefijo por subcategoría (TEC-SIS-0023)", async () => {
    const escrito = prepararAlta(22);
    const t = await tickets.crearTicket(ADMIN, solicitud);
    assert.equal(t.folio, "TEC-SIS-0023");
    assert.equal(escrito.tickets[0].piso, "NIVEL_1"); // el piso se deriva del área
  });

  it("registra el estado inicial ABIERTO en el historial", async () => {
    const escrito = prepararAlta();
    await tickets.crearTicket(ADMIN, solicitud);
    assert.equal(escrito.historial[0].estadoNuevo, "ABIERTO");
    assert.equal(escrito.historial[0].comentario, "Solicitud creada");
  });

  it("reintenta con un folio nuevo si dos altas simultáneas chocan por índice único", async () => {
    prepararAlta();
    let maximo = 40;
    doble.$queryRaw = async () => [{ maximo: maximo++ }];
    let intentos = 0;
    doble.ticket.create = async ({ data }: any) => {
      if (++intentos === 1) throw { code: "P2002", meta: { target: ["folio"] } };
      return { id: 101, ...data };
    };
    const t = await tickets.crearTicket(ADMIN, solicitud);
    assert.equal(intentos, 2);
    assert.equal(t.folio, "TEC-SIS-0042");
  });

  it("rechaza con 403 la quinta solicitud activa de un empleado", async () => {
    doble.ticket.count = async () => 4;
    await assert.rejects(tickets.crearTicket(EMPLEADO, solicitud), {
      status: 403,
      message: "Límite de solicitudes activas alcanzado (máximo 4)",
    });
  });

  it("permite la cuarta solicitud (3 activas) y continúa con la validación del área", async () => {
    doble.ticket.count = async () => 3;
    await assert.rejects(tickets.crearTicket(EMPLEADO, solicitud), {
      status: 404,
      message: "Área no encontrada",
    });
  });

  it("rechaza una categoría que no está en el catálogo", async () => {
    prepararAlta();
    await assert.rejects(tickets.crearTicket(ADMIN, { ...solicitud, categoria: "HARDWARE" }), {
      status: 400,
    });
  });

  it("el servidor rechaza una solicitud con asunto y descripción vacíos (400)", async () => {
    prepararAlta();
    await assert.rejects(
      tickets.crearTicket(ADMIN, { ...solicitud, asunto: "", descripcion: "" }),
      { status: 400 },
    );
  });

  it("el personal debe indicar el RFC del solicitante", async () => {
    await assert.rejects(tickets.crearTicket(MESA, { ...solicitud, rfcSolicitante: undefined }), {
      status: 400,
      message: "El RFC del solicitante es obligatorio",
    });
  });
});

describe("listarTickets — prioridad automática y orden de atención", () => {
  it("calcula la prioridad por antigüedad, respeta la manual y ordena por prioridad", async () => {
    const hace = (h: number) => new Date(Date.now() - h * 3_600_000);
    doble.ticket.findMany = async () => [
      { id: 1, estado: "ABIERTO", createdAt: hace(1), prioridadManual: null },
      { id: 2, estado: "ASIGNADO", createdAt: hace(10), prioridadManual: null },
      { id: 3, estado: "EN_PROGRESO", createdAt: hace(30), prioridadManual: null },
      { id: 4, estado: "ABIERTO", createdAt: hace(2), prioridadManual: "ALTA" },
      { id: 5, estado: "RESUELTO", createdAt: hace(50), prioridadManual: null },
    ];
    doble.ticket.count = async () => 5;
    const r = await tickets.listarTickets(ADMIN, {});
    assert.deepEqual(
      r.tickets.map((t: any) => [t.id, t.prioridad]),
      [
        [3, "URGENTE"], // más de 24 h sin resolver
        [4, "ALTA"], // ajuste manual de Mesa de Ayuda
        [2, "MEDIA"], // más de 6 h
        [1, "BAJA"], // reciente
        [5, "BAJA"], // finalizada: al final de la lista
      ],
    );
  });
});

describe("actualizarPrioridad / obtenerTicketPorFolio — validaciones", () => {
  it("un empleado no puede cambiar la prioridad (403)", async () => {
    await assert.rejects(tickets.actualizarPrioridad(1, "ALTA", EMPLEADO), { status: 403 });
  });
  it("rechaza una prioridad fuera del catálogo (400)", async () => {
    await assert.rejects(tickets.actualizarPrioridad(1, "CRITICA", MESA), { status: 400 });
  });
  it("rechaza un folio con formato inválido (400)", async () => {
    await assert.rejects(tickets.obtenerTicketPorFolio("../etc/passwd", ADMIN), { status: 400 });
  });
  it("normaliza el folio a mayúsculas antes de buscarlo", async () => {
    let buscado = "";
    doble.ticket.findFirst = async ({ where }: any) => ((buscado = where.folio), null);
    await assert.rejects(tickets.obtenerTicketPorFolio(" tec-sis-0023 ", ADMIN), { status: 404 });
    assert.equal(buscado, "TEC-SIS-0023");
  });
});

describe("cambiarEstado — flujo de estatus y control de acceso", () => {
  const ticket = (extra: object) => async () => ({
    id: 1,
    estado: "ABIERTO",
    empleadoRfc: EMPLEADO.rfc,
    subcategoria: "RED_INTERNET",
    categoria: "TECNOLOGIAS",
    tecnicoId: null,
    ...extra,
  });
  it("no permite reabrir una solicitud RESUELTA", async () => {
    doble.ticket.findFirst = ticket({ estado: "RESUELTO" });
    await assert.rejects(tickets.cambiarEstado(1, { estado: "EN_PROGRESO" }, ADMIN), {
      status: 400,
      message: "Transición no permitida: RESUELTO → EN_PROGRESO",
    });
  });
  it("un empleado no puede operar la solicitud de otra persona", async () => {
    doble.ticket.findFirst = ticket({ empleadoRfc: "OTRO800101AB1" });
    await assert.rejects(tickets.cambiarEstado(1, { estado: "CANCELADO" }, EMPLEADO), {
      status: 403,
    });
  });
  it("un empleado solo cancela su solicitud mientras está ABIERTA", async () => {
    doble.ticket.findFirst = ticket({ estado: "ASIGNADO" });
    await assert.rejects(tickets.cambiarEstado(1, { estado: "CANCELADO" }, EMPLEADO), {
      status: 403,
    });
  });
  it("un técnico no asignado no puede cambiar el estado", async () => {
    doble.ticket.findFirst = ticket({ estado: "ASIGNADO", tecnicoId: 99 });
    await assert.rejects(tickets.cambiarEstado(1, { estado: "EN_PROGRESO" }, TECNICO), {
      status: 403,
      message: "Solo el técnico asignado puede cambiar el estado",
    });
  });
});

describe("obtenerTicket — detalle visto por el solicitante", () => {
  it("el empleado no recibe los comentarios internos del personal", async () => {
    doble.ticket.findFirst = async () => ({
      id: 1,
      estado: "EN_PROGRESO",
      createdAt: new Date(),
      prioridadManual: null,
      empleadoRfc: EMPLEADO.rfc,
      comentarios: [
        { id: 1, texto: "Ya revisamos su equipo", esInterno: false },
        { id: 2, texto: "Nota interna del técnico", esInterno: true },
      ],
    });
    doble.ticket.count = async () => 1; // la solicitud es suya: está dentro de su alcance
    const t: any = await tickets.obtenerTicket(1, EMPLEADO);
    assert.deepEqual(
      t.comentarios.filter((c: any) => c.esInterno),
      [],
    );
  });
});

describe("alcanceLecturaTickets — qué solicitudes ve cada rol", () => {
  it("Administrador y Mesa de Ayuda ven todas", async () => {
    assert.deepEqual(await alcanceLecturaTickets(ADMIN), {});
    assert.deepEqual(await alcanceLecturaTickets(MESA), {});
  });
  it("el empleado solo ve las propias (por RFC)", async () => {
    assert.deepEqual(await alcanceLecturaTickets(EMPLEADO), { empleadoRfc: EMPLEADO.rfc });
  });
  it("el gestor de salas solo ve solicitudes de sala de juntas", async () => {
    const r = await alcanceLecturaTickets({ id: 8, rol: "GESTOR_SALAS_JUNTA", nombre: "G" } as any);
    assert.deepEqual(r, {
      categoria: "RECURSOS_MATERIALES",
      subcategoria: { in: ["SALA_JUNTAS"] },
    });
  });
  it("un responsable sin área asignada no ve ninguna (denegación por omisión)", async () => {
    const r = await alcanceLecturaTickets({ id: 9, rol: "RESPONSABLE_TI", nombre: "R" } as any);
    assert.deepEqual(r, { id: { in: [] } });
  });
});
