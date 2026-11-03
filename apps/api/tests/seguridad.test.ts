/**
 * Pruebas unitarias — Seguridad: bloqueo progresivo de IP, JWT, OTP, contraseñas,
 * sesiones y validación de adjuntos. La base de datos se sustituye por un doble en
 * memoria (tests/helpers/prisma-doble.ts); no se abre conexión con MySQL.
 */
import { doble, reiniciarDoble } from "./helpers/prisma-doble.ts";
import { describe, it, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import bcrypt from "bcrypt";

const { verificarBloqueo, registrarIntento, intentosRestantes } =
  await import("../src/services/ip-lockout.service.ts");
const { signToken, verifyToken } = await import("../src/config/jwt.ts");
const { verificarOtp, maskTelefono } = await import("../src/services/otp.service.ts");
const { maskEmail } = await import("../src/services/email.service.ts");
const { loginStaff, loginRFC } = await import("../src/services/auth.service.ts");
const { crearSesion } = await import("../src/services/sesiones.service.ts");
const { extensionDe } = await import("../src/middleware/upload.middleware.ts");
const { validarFirmas } = await import("../src/services/adjuntos.service.ts");

beforeEach(() => reiniciarDoble());

// ── Bloqueo progresivo por IP ────────────────────────────────────────────────
describe("ip-lockout.service — bloqueo progresivo", () => {
  const realNow = Date.now;
  let ahora = 1_000_000_000_000;
  const avanzarMin = (min: number) => (ahora += min * 60_000);
  beforeEach(() => {
    Date.now = () => ahora;
  });
  after(() => {
    Date.now = realNow;
  });

  it("informa los intentos restantes antes del bloqueo", () => {
    const ip = "10.0.0.1";
    assert.equal(intentosRestantes(ip), 5);
    registrarIntento(ip, true);
    registrarIntento(ip, true);
    assert.equal(intentosRestantes(ip), 3);
    assert.equal(verificarBloqueo(ip).bloqueado, false);
  });

  it("5 intentos fallidos bloquean la IP durante 3 minutos", () => {
    const ip = "10.0.0.2";
    for (let i = 0; i < 5; i++) registrarIntento(ip, true);
    assert.deepEqual(verificarBloqueo(ip), { bloqueado: true, minutosRestantes: 3 });
    avanzarMin(3);
    assert.equal(verificarBloqueo(ip).bloqueado, false);
  });

  it("la reincidencia suma 2 minutos (3 → 5 → 7)", () => {
    const ip = "10.0.0.3";
    const duraciones: number[] = [];
    for (let ronda = 0; ronda < 3; ronda++) {
      for (let i = 0; i < 5; i++) registrarIntento(ip, true);
      duraciones.push(verificarBloqueo(ip).minutosRestantes ?? 0);
      avanzarMin(10);
      verificarBloqueo(ip);
    }
    assert.deepEqual(duraciones, [3, 5, 7]);
  });

  it("tras 24 h sin bloqueos la progresión vuelve a 3 minutos", () => {
    const ip = "10.0.0.4";
    for (let i = 0; i < 5; i++) registrarIntento(ip, true);
    avanzarMin(10);
    for (let i = 0; i < 5; i++) registrarIntento(ip, true); // segundo bloqueo: 5 min
    avanzarMin(25 * 60);
    verificarBloqueo(ip);
    for (let i = 0; i < 5; i++) registrarIntento(ip, true);
    assert.equal(verificarBloqueo(ip).minutosRestantes, 3);
  });

  it("un acceso exitoso reinicia el contador de intentos fallidos", () => {
    const ip = "10.0.0.5";
    for (let i = 0; i < 4; i++) registrarIntento(ip, true);
    registrarIntento(ip, false);
    assert.equal(intentosRestantes(ip), 5);
  });
});

// ── JWT ──────────────────────────────────────────────────────────────────────
describe("config/jwt — tokens de autenticación", () => {
  it("firma y verifica un token conservando rol e identificador", () => {
    const token = signToken({ id: 7, rol: "MESA_AYUDA", nombre: "Mesa Ayuda", jti: "abc" });
    const payload = verifyToken(token);
    assert.equal(payload.id, 7);
    assert.equal(payload.rol, "MESA_AYUDA");
    assert.ok(payload.exp && payload.iat && payload.exp > payload.iat);
  });
  it("rechaza un token alterado", () => {
    const token = signToken({ id: 7, rol: "EMPLEADO", nombre: "X" });
    const [h, , s] = token.split(".");
    const falso = Buffer.from(JSON.stringify({ id: 1, rol: "ADMIN", nombre: "X" })).toString(
      "base64url",
    );
    assert.throws(() => verifyToken(`${h}.${falso}.${s}`));
  });
});

// ── Contraseñas, OTP y sesiones ──────────────────────────────────────────────
describe("auth.service — acceso de personal y de empleados", () => {
  it("loginStaff rechaza una contraseña incorrecta con 401 y registra el intento", async () => {
    const hash = await bcrypt.hash("Correcta#2024", 4);
    const registros: any[] = [];
    doble.usuario.findUnique = async () => ({
      id: 3,
      usuario: "mesa",
      password: hash,
      activo: true,
    });
    doble.logAcceso.create = async ({ data }: any) => registros.push(data);
    await assert.rejects(loginStaff("mesa", "incorrecta"), { status: 401 });
    assert.equal(registros[0].resultado, "FAIL_PASSWORD");
  });
  it("loginStaff con contraseña correcta devuelve token y usuario sin contraseña", async () => {
    const hash = await bcrypt.hash("Correcta#2024", 4);
    doble.usuario.findUnique = async () => ({
      id: 3,
      usuario: "mesa",
      password: hash,
      activo: true,
      nombre: "Mesa",
      apellidos: "Ayuda",
      email: null,
      rol: "MESA_AYUDA",
      areaSoporteId: null,
    });
    const r = await loginStaff("mesa", "Correcta#2024");
    assert.equal(verifyToken(r.token).rol, "MESA_AYUDA");
    assert.equal((r.user as any).password, undefined);
  });
  it("loginRFC rechaza un RFC con formato inválido sin consultar la base", async () => {
    let consultas = 0;
    doble.empleado.findUnique = async () => (consultas++, null);
    await assert.rejects(loginRFC("12345"), { status: 400, message: "Formato de RFC inválido" });
    assert.equal(consultas, 0);
  });
});

describe("otp.service — verificación del código", () => {
  it("acepta el código correcto (almacenado como hash) y lo marca como usado", async () => {
    const codigoHash = await bcrypt.hash("482913", 4);
    let marcado = false;
    doble.otpToken.findFirst = async () => ({ id: 9, codigo: codigoHash });
    doble.otpToken.update = async ({ data }: any) => (marcado = data.usado);
    await verificarOtp("GOMJ800101AB1", "482913");
    assert.equal(marcado, true);
  });
  it("rechaza un código incorrecto con 401", async () => {
    const codigoHash = await bcrypt.hash("482913", 4);
    doble.otpToken.findFirst = async () => ({ id: 9, codigo: codigoHash });
    await assert.rejects(verificarOtp("GOMJ800101AB1", "000000"), { status: 401 });
  });
  it("rechaza con 401 cuando no hay código vigente", async () => {
    await assert.rejects(verificarOtp("GOMJ800101AB1", "482913"), { status: 401 });
  });
  it("enmascara teléfono y correo en las pistas de envío", () => {
    assert.equal(maskTelefono("9511234567"), "******4567");
    assert.equal(maskEmail("jperez@finanzasoaxaca.gob.mx"), "j***z@finanzasoaxaca.gob.mx");
  });
});

describe("sesiones.service — límite de sesiones simultáneas", () => {
  it("al abrir una tercera sesión cierra la más antigua (máximo 2)", async () => {
    let cerradas: number[] = [];
    doble.sesion.findMany = async () => [{ id: 11 }, { id: 12 }];
    doble.sesion.updateMany = async ({ where }: any) => (cerradas = where.id.in);
    const jti = await crearSesion({ usuarioId: 3, expiresInMs: 60_000 });
    assert.deepEqual(cerradas, [11]);
    assert.match(jti, /^[0-9a-f-]{36}$/);
  });
});

// ── Adjuntos ─────────────────────────────────────────────────────────────────
describe("Adjuntos — extensión y firma del archivo", () => {
  const dir = path.join(os.tmpdir(), `siast-pruebas-${process.pid}`);
  const archivo = async (nombre: string, bytes: number[]) => {
    await fs.mkdir(dir, { recursive: true });
    const p = path.join(dir, nombre);
    await fs.writeFile(p, Buffer.from(bytes));
    return { path: p, originalname: nombre } as any;
  };
  after(() => fs.rm(dir, { recursive: true, force: true }));

  it("extensionDe normaliza a minúsculas y sin punto", () => {
    assert.equal(extensionDe("Reporte.PDF"), "pdf");
    assert.equal(extensionDe("foto.equipo.JPG"), "jpg");
    assert.equal(extensionDe("sin_extension"), "");
  });
  it("acepta un JPG con firma real FF D8 FF", async () => {
    const jpg = await archivo("evidencia.jpg", [0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
    await assert.doesNotReject(validarFirmas([jpg]));
  });
  it("rechaza un ejecutable renombrado a .png", async () => {
    const exe = await archivo("virus.png", [0x4d, 0x5a, 0x90, 0x00]);
    await assert.rejects(validarFirmas([exe]), { status: 400 });
  });
  it("rechaza un archivo vacío", async () => {
    const vacio = await archivo("vacio.pdf", []);
    await assert.rejects(validarFirmas([vacio]), { status: 400 });
  });
});
