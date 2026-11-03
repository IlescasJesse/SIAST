/**
 * Pruebas unitarias — Esquemas de validación y reglas de negocio de @stf/shared.
 * Ejecutar desde la raíz: npx tsx --test apps/api/tests/*.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  LoginEmpleadoSchema,
  LoginSchema,
  TicketCreateSchema,
  PrioridadTicketSchema,
  EstadoTicketSchema,
  RolSchema,
  MAX_TICKETS_ACTIVOS_EMPLEADO,
  ADJUNTOS_TIPOS,
  ADJUNTOS_MAX_ARCHIVOS,
  ADJUNTOS_MAX_BYTES,
  SUBCATEGORIAS_POR_CATEGORIA,
  FOLIO_PREFIX,
  PERMISOS_DEFAULT,
  PERMISOS_LIST,
  tienePermiso,
  CrearNovedadSchema,
  CrearAvisoSistemaSchema,
} from "@stf/shared";

const ticketValido = {
  asunto: "Sin acceso a internet",
  descripcion: "Desde esta mañana el equipo no navega.",
  categoria: "TECNOLOGIAS",
  subcategoria: "RED_INTERNET",
  empleadoRfc: "GOMJ800101AB1",
  areaId: "dir_admin",
  piso: "NIVEL_1",
};

describe("LoginEmpleadoSchema (acceso por RFC)", () => {
  it("acepta un RFC de 13 caracteres", () => {
    assert.equal(LoginEmpleadoSchema.safeParse({ rfc: "GOMJ800101AB1" }).success, true);
  });
  it("rechaza un RFC de longitud distinta a 13", () => {
    assert.equal(LoginEmpleadoSchema.safeParse({ rfc: "GOMJ800101" }).success, false);
    assert.equal(LoginEmpleadoSchema.safeParse({ rfc: "GOMJ800101AB12" }).success, false);
  });
});

describe("LoginSchema (acceso de personal)", () => {
  it("exige usuario de al menos 3 y contraseña de al menos 4 caracteres", () => {
    assert.equal(LoginSchema.safeParse({ usuario: "mesa", password: "1234" }).success, true);
    assert.equal(LoginSchema.safeParse({ usuario: "ab", password: "1234" }).success, false);
    assert.equal(LoginSchema.safeParse({ usuario: "mesa", password: "123" }).success, false);
  });
});

describe("TicketCreateSchema (formulario de solicitud)", () => {
  it("acepta una solicitud completa y asigna prioridad MEDIA por omisión", () => {
    const r = TicketCreateSchema.safeParse(ticketValido);
    assert.equal(r.success, true);
    assert.equal(r.success && r.data.prioridad, "MEDIA");
  });
  it("rechaza asunto menor a 5 caracteres", () => {
    assert.equal(TicketCreateSchema.safeParse({ ...ticketValido, asunto: "Red" }).success, false);
  });
  it("rechaza descripción menor a 10 caracteres", () => {
    const r = TicketCreateSchema.safeParse({ ...ticketValido, descripcion: "No sirve" });
    assert.equal(r.success, false);
  });
  it("rechaza una categoría fuera del catálogo", () => {
    const r = TicketCreateSchema.safeParse({ ...ticketValido, categoria: "HARDWARE" });
    assert.equal(r.success, false);
  });
});

describe("Catálogos de estado, prioridad y rol", () => {
  it("prioridades: BAJA, MEDIA, ALTA y URGENTE", () => {
    assert.deepEqual(PrioridadTicketSchema.options, ["BAJA", "MEDIA", "ALTA", "URGENTE"]);
  });
  it("estados: ABIERTO, ASIGNADO, EN_PROGRESO, RESUELTO y CANCELADO", () => {
    assert.deepEqual(EstadoTicketSchema.options, [
      "ABIERTO",
      "ASIGNADO",
      "EN_PROGRESO",
      "RESUELTO",
      "CANCELADO",
    ]);
  });
  it("incluye los roles mínimos: solicitante (EMPLEADO), administrador y soporte", () => {
    for (const rol of ["EMPLEADO", "ADMIN", "MESA_AYUDA", "TECNICO_TI"]) {
      assert.equal(RolSchema.safeParse(rol).success, true, rol);
    }
    assert.equal(RolSchema.safeParse("SUPERUSUARIO").success, false);
  });
});

describe("Reglas de negocio", () => {
  it("MAX_TICKETS_ACTIVOS_EMPLEADO es 4", () => {
    assert.equal(MAX_TICKETS_ACTIVOS_EMPLEADO, 4);
  });
  it("adjuntos: máximo 5 archivos de 10 MB; JPG admitido como image/jpeg", () => {
    assert.equal(ADJUNTOS_MAX_ARCHIVOS, 5);
    assert.equal(ADJUNTOS_MAX_BYTES, 10 * 1024 * 1024);
    assert.deepEqual(ADJUNTOS_TIPOS.jpg, ["image/jpeg"]);
    assert.deepEqual(ADJUNTOS_TIPOS.jpeg, ["image/jpeg"]);
    assert.equal(ADJUNTOS_TIPOS.exe, undefined);
  });
  it("cada subcategoría del catálogo tiene un prefijo de folio propio y único", () => {
    const prefijos: string[] = [];
    for (const [cat, subs] of Object.entries(SUBCATEGORIAS_POR_CATEGORIA)) {
      for (const sub of subs) {
        const prefijo = FOLIO_PREFIX[`${cat}-${sub}`];
        assert.ok(prefijo, `${cat}-${sub} sin prefijo`);
        prefijos.push(prefijo);
      }
    }
    assert.equal(new Set(prefijos).size, prefijos.length);
    assert.equal(FOLIO_PREFIX["TECNOLOGIAS-CUENTAS_DOMINIO"], "TEC-DOM");
  });
});

describe("Permisos por rol (tienePermiso)", () => {
  it("ADMIN tiene todos los permisos", () => {
    assert.deepEqual([...PERMISOS_DEFAULT.ADMIN].sort(), [...PERMISOS_LIST].sort());
  });
  it("EMPLEADO no tiene permisos de personal", () => {
    assert.equal(tienePermiso("EMPLEADO", null, "solicitudes.ver_todas"), false);
    assert.equal(tienePermiso("EMPLEADO", [], "admin.acceso"), false);
  });
  it("un permiso extra concedido al usuario se respeta", () => {
    assert.equal(tienePermiso("TECNICO_TI", null, "reportes.generar"), false);
    assert.equal(tienePermiso("TECNICO_TI", ["reportes.generar"], "reportes.generar"), true);
  });
  it("Mesa de Ayuda puede asignar pero no administrar usuarios", () => {
    assert.equal(tienePermiso("MESA_AYUDA", null, "solicitudes.asignar"), true);
    assert.equal(tienePermiso("MESA_AYUDA", null, "usuarios.gestionar"), false);
  });
});

describe("Avisos del sistema y novedades", () => {
  it("CrearNovedadSchema exige al menos un punto y audiencia TODOS por omisión", () => {
    const ok = CrearNovedadSchema.safeParse({ titulo: "Nueva versión", puntos: ["Adjuntos"] });
    assert.equal(ok.success, true);
    assert.equal(ok.success && ok.data.audiencia, "TODOS");
    assert.equal(CrearNovedadSchema.safeParse({ titulo: "X", puntos: [] }).success, false);
  });
  it("CrearAvisoSistemaSchema rechaza un tipo de aviso desconocido", () => {
    assert.equal(CrearAvisoSistemaSchema.safeParse({ tipo: "OTRO", titulo: "x" }).success, false);
    assert.equal(
      CrearAvisoSistemaSchema.safeParse({ tipo: "MANTENIMIENTO", titulo: "Ventana" }).success,
      true,
    );
  });
});
