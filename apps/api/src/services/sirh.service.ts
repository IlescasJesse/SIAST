/**
 * sirh.service.ts
 *
 * Servicio de integración con SIRH.
 * Solo actúa cuando SIRH_ENABLED=true en el .env.
 *
 * Funciones exportadas:
 *   syncEmpleados()       — sincronización completa al arrancar la API
 *   fetchEmpleadoByRfc()  — búsqueda/upsert individual al hacer login-rfc
 */

import { PisoEdificio } from "@prisma/client";
import { prisma } from "../config/database.js";

// ============================================================
// Config
// ============================================================

const SIRH_ENABLED = process.env.SIRH_ENABLED === "true";
const SIRH_BASE_URL = process.env.SIRH_BASE_URL ?? "http://localhost:3000";
const SIRH_EMPLOYEES_PATH = "/api/personal/getEmployees";
const SIRH_URL = `${SIRH_BASE_URL}${SIRH_EMPLOYEES_PATH}`;

// ============================================================
// Tipos del payload SIRH
// ============================================================

interface SirhEmpleado {
  _id: string;
  RFC?: string;
  NOMBRES?: string;
  APE_PAT?: string;
  APE_MAT?: string;
  DEPARTAMENTO?: string;
  ADSCRIPCION?: string;
  NOMCATE?: string;
  EMAIL?: string;
  status?: number;
}

// ============================================================
// Mapeo DEPARTAMENTO → { areaId, piso }
// Empleados sin mapeo caen en FALLBACK (n3_nivel3_general)
// ============================================================

interface AreaMapping {
  areaId: string;
  piso: PisoEdificio;
}

const FALLBACK: AreaMapping = { areaId: "n3_nivel3_general", piso: PisoEdificio.NIVEL_3 };

const DEPT_TO_AREA: Record<string, AreaMapping> = {
  // ─── PLANTA BAJA ────────────────────────────────────────────────────────────
  "DIRECCIÓN ADMINISTRATIVA":             { areaId: "pb_unidad_administrativa", piso: PisoEdificio.PB },
  "DIRECCION ADMINISTRATIVA":             { areaId: "pb_unidad_administrativa", piso: PisoEdificio.PB },
  "DIRECCIóN ADMINISTRATIVA":             { areaId: "pb_unidad_administrativa", piso: PisoEdificio.PB },
  "DIRECCIÓN ADMINISTRATIVA. FISCALIA":   { areaId: "pb_unidad_administrativa", piso: PisoEdificio.PB },
  "UNIDAD ADMINISTRATIVA (ARCHIVO)":      { areaId: "pb_archivos",              piso: PisoEdificio.PB },
  "TESORERÍA":                            { areaId: "pb_control",               piso: PisoEdificio.PB },
  "TESORERIA":                            { areaId: "pb_control",               piso: PisoEdificio.PB },
  "SUBSECRETARÍA DE INGRESOS":            { areaId: "pb_ingresos",              piso: PisoEdificio.PB },
  "DIRECCIÓN DE INGRESOS Y RECAUDACIÓN":  { areaId: "pb_ingresos",              piso: PisoEdificio.PB },
  "DEPARTAMENTO DE CONTROL DE INGRESOS":  { areaId: "pb_ingresos",              piso: PisoEdificio.PB },
  "COORDINACIÓN TÉCNICA DE INGRESOS":     { areaId: "pb_ingresos",              piso: PisoEdificio.PB },
  "DEPARTAMENTO DE REGISTRO DE CONTRIBUYENTES": { areaId: "pb_ingresos",        piso: PisoEdificio.PB },
  "DEPTO. DE CTRL.DE MOV.AL PADRON DE MPIOS":   { areaId: "pb_ingresos",        piso: PisoEdificio.PB },
  "COORDINACIÓN DE CENTROS INTEGRALES DE ATENCIÓN AL CONTRIBUYENTE": { areaId: "pb_atencion_ciudadana", piso: PisoEdificio.PB },
  "COORDINACION DE CENTROS INTEGRALES DE ATENCION AL CONTRIBUYENTE": { areaId: "pb_atencion_ciudadana", piso: PisoEdificio.PB },
  "CENTRO INTEGRAL DE ASESORÍA Y ATENCIÓN":     { areaId: "pb_atencion_ciudadana", piso: PisoEdificio.PB },
  "DEPARTAMENTO DE TRAMITACIÓN DE SOLICITUDES": { areaId: "pb_atencion_ciudadana", piso: PisoEdificio.PB },
  "MODULO DE ATENCIÓN AL CONTRIBUYENTE DE OAXACA DE JUAREZ":  { areaId: "pb_atencion_ciudadana", piso: PisoEdificio.PB },
  "MóDULO DE ATENCIóN AL CONTRIBUYENTE DE OAXACA DE JUáREZ": { areaId: "pb_atencion_ciudadana", piso: PisoEdificio.PB },
  "DEPARTAMENTO DE ENLACE Y COMUNICACIÓN": { areaId: "pb_atencion_ciudadana",   piso: PisoEdificio.PB },
  "DEPARTAMENTO DE ENLACE Y VERIFICACIÓN": { areaId: "pb_atencion_ciudadana",   piso: PisoEdificio.PB },

  // ─── NIVEL 1 ────────────────────────────────────────────────────────────────
  "OFICINA DEL SECRETARIO":                    { areaId: "n1_secretaria",        piso: PisoEdificio.NIVEL_1 },
  "SECRETARIO DE FINANZAS":                    { areaId: "n1_secretaria",        piso: PisoEdificio.NIVEL_1 },
  "ASESORÍA":                                  { areaId: "n1_secretaria",        piso: PisoEdificio.NIVEL_1 },
  "COORDINACIÓN DE GIRAS Y PROTOCOLO":         { areaId: "n1_secretaria",        piso: PisoEdificio.NIVEL_1 },
  "DEPARTAMENTO DE PLANEACIÓN DE GIRAS":       { areaId: "n1_secretaria",        piso: PisoEdificio.NIVEL_1 },
  "DEPARTAMENTO DE PROTOCOLO Y LOGÍSTICA":     { areaId: "n1_secretaria",        piso: PisoEdificio.NIVEL_1 },
  "PERSONAL ADSCRITO A LA SECRETARÍA DE FINANZAS (HANGAR)": { areaId: "n1_secretaria", piso: PisoEdificio.NIVEL_1 },
  "CASA OFICIAL DE GOBIERNO":                  { areaId: "n1_secretaria",        piso: PisoEdificio.NIVEL_1 },
  "SUBSECRETARÍA DE PLANEACIÓN E INVERSIÓN PÚBLICA":  { areaId: "n1_subsec_planeacion", piso: PisoEdificio.NIVEL_1 },
  "DIRECCIÓN DE PLANEACIÓN ESTATAL":           { areaId: "n1_subsec_planeacion", piso: PisoEdificio.NIVEL_1 },
  "COORDINACIÓN DE APOYO TÉCNICO PARA LA PLANEACIÓN E INVERSIÓN": { areaId: "n1_subsec_planeacion", piso: PisoEdificio.NIVEL_1 },
  "COORDINACIÓN DE PLANEACIÓN Y PROYECTOS DE INVERSIÓN":          { areaId: "n1_subsec_planeacion", piso: PisoEdificio.NIVEL_1 },
  "DIRECCIÓN DE PROGRAMACIÓN DE LA INVERSIÓN PÚBLICA":            { areaId: "n1_subsec_planeacion", piso: PisoEdificio.NIVEL_1 },
  "COORDINACIÓN DE PROGRAMACIÓN Y CONTROL DE LA INVERSIÓN PÚBLICA \"A\"": { areaId: "n1_subsec_planeacion", piso: PisoEdificio.NIVEL_1 },
  "COORDINACIÓN DE PROGRAMACIÓN Y CONTROL DE LA INVERSIÓN PÚBLICA \"B\"": { areaId: "n1_subsec_planeacion", piso: PisoEdificio.NIVEL_1 },
  "DEPARTAMENTO DE ASUNTOS JURÍDICOS":         { areaId: "n1_juridico",          piso: PisoEdificio.NIVEL_1 },
  "DIRECCIÓN DE NORMATIVIDAD Y ASUNTOS JURÍDICOS": { areaId: "n1_juridico",      piso: PisoEdificio.NIVEL_1 },
  "PROCURADURÍA FISCAL":                       { areaId: "n1_juridico",          piso: PisoEdificio.NIVEL_1 },
  "UNIDAD JURÍDICA":                           { areaId: "n1_juridico",          piso: PisoEdificio.NIVEL_1 },
  "DIRECCIÓN DE LO CONTENCIOSO":               { areaId: "n1_juridico",          piso: PisoEdificio.NIVEL_1 },
  "DEPARTAMENTO DE JUICIOS Y RECURSOS":        { areaId: "n1_juridico",          piso: PisoEdificio.NIVEL_1 },
  "DEPARTAMENTO DE PROCEDIMIENTOS ADMINISTRATIVOS": { areaId: "n1_juridico",     piso: PisoEdificio.NIVEL_1 },
  "DEPARTAMENTO DE NORMATIVIDAD":              { areaId: "n1_juridico",          piso: PisoEdificio.NIVEL_1 },
  "DEPARTAMENTO DE NORMATIVIDAD Y DESARROLLO METODOLÓGICO": { areaId: "n1_juridico", piso: PisoEdificio.NIVEL_1 },
  "SUBSECRETARÍA DE EGRESOS, CONTABILIDAD Y TESORERÍA": { areaId: "n1_secretaria", piso: PisoEdificio.NIVEL_1 },
  "UNIDAD TÉCNICA":                            { areaId: "n1_oficina_alterna",   piso: PisoEdificio.NIVEL_1 },
  "UNIDAD DE INFORMES SOBRE EL ESTADO DE LA GESTIÓN PÚBLICA": { areaId: "n1_oficina_alterna", piso: PisoEdificio.NIVEL_1 },
  "CENTRO DE IMPLEMENTACIÓN,EVALUACIÓN Y SEGUIMIENTO DEL P.M.A.C": { areaId: "n1_oficina_alterna", piso: PisoEdificio.NIVEL_1 },

  // ─── NIVEL 2 ────────────────────────────────────────────────────────────────
  "OTORGAMIENTO DE SERVICIOS ADMINISTRATIVOS(DIRECCIÓN DE TECNOLOGÍAS DE LA INFORMACIÓN)": { areaId: "n2_informatica", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE ADMINISTRACIÓN TRIBUTARIA":    { areaId: "n2_recaudacion",    piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE ADMINISTRACIóN TRIBUTARIA":    { areaId: "n2_recaudacion",    piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE ADMINISTRACION TRIBUTARIA":    { areaId: "n2_recaudacion",    piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE REGISTRO Y CONTROL DE CRÉDITOS": { areaId: "n2_recaudacion", piso: PisoEdificio.NIVEL_2 },
  "COORDINACIÓN DE COBRO COACTIVO":               { areaId: "n2_recaudacion",    piso: PisoEdificio.NIVEL_2 },
  "COORDINACIóN DE COBRO COACTIVO":               { areaId: "n2_recaudacion",    piso: PisoEdificio.NIVEL_2 },
  "COORDINACIÓN DE VISITAS DOMICILIARIAS":        { areaId: "n2_recaudacion",    piso: PisoEdificio.NIVEL_2 },
  "COORDINACIÓN DE REVISIÓN DE GABINETE Y MASIVA":  { areaId: "n2_recaudacion", piso: PisoEdificio.NIVEL_2 },
  "COORDINACIóN DE REVISIÓN DE GABINETE Y MASIVA":  { areaId: "n2_recaudacion", piso: PisoEdificio.NIVEL_2 },
  "COORDINACIóN DE REVISIóN DE GABINETE Y MASIVA":  { areaId: "n2_recaudacion", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE REVISIÓN DE GABINETE":         { areaId: "n2_recaudacion",    piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE VERIFICACIÓN Y REVISIÓN DE MASIVAS": { areaId: "n2_recaudacion", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE VERIFICACIóN Y REVISIóN DE MASIVAS": { areaId: "n2_recaudacion", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE CONTROL DE OBLIGACIONES":      { areaId: "n2_recaudacion",    piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE REVISIÓN DE DICTÁMENES":       { areaId: "n2_recaudacion",    piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE REVISIóN DE DICTáMENES":       { areaId: "n2_recaudacion",    piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE CONSULTAS, SOLICITUDES Y NOTIFICACIONES": { areaId: "n2_recaudacion", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE CONSULTAS SOLICITUDES Y NOTIFICACIONES":  { areaId: "n2_recaudacion", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE REVISIÓN A RENGLONES ESPECÍFICOS": { areaId: "n2_recaudacion", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE REVISIóN A RENGLONES ESPECíFICOS": { areaId: "n2_recaudacion", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE AUDITORÍAS A PERSONAS FÍSICAS":   { areaId: "n2_recaudacion", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE AUDITORÍAS A PERSONAS MORALES":   { areaId: "n2_recaudacion", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE CONTROL Y EJECUCIÓN DE CRÉDITOS": { areaId: "n2_recaudacion", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE SEGUIMIENTO DE CRÉDITOS":      { areaId: "n2_recaudacion",    piso: PisoEdificio.NIVEL_2 },
  "DIRECCIÓN DE AUDITORÍA E INSPECCIÓN FISCAL":   { areaId: "n2_contraloria",    piso: PisoEdificio.NIVEL_2 },
  "COORDINACIÓN DE AUDITORÍAS, ARMONIZACIÓN CONTABLE Y FINANCIERA": { areaId: "n2_contraloria", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE REVISIÓN Y ANÁLISIS DEL SECTOR CENTRAL":   { areaId: "n2_contraloria", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE REVISIÓN Y ANÁLISIS DEL SECTOR PARAESTATAL": { areaId: "n2_contraloria", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE ANÁLISIS Y ARMONIZACIÓN CONTABLE":          { areaId: "n2_contraloria", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE REVISIÓN Y ANÁLISIS CONTABLE DE LOS INGRESOS": { areaId: "n2_contraloria", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE ATENCIÓN Y SEGUIMIENTO A LOS PROCESOS DE AUDITORÍAS": { areaId: "n2_contraloria", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE REVISIÓN FINANCIERA":          { areaId: "n2_contraloria",    piso: PisoEdificio.NIVEL_2 },
  "DIRECCIÓN DE CONTABILIDAD GUBERNAMENTAL":      { areaId: "n2_egresos",        piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE RECURSOS FINANCIEROS":         { areaId: "n2_egresos",        piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE CONTROL DE FONDOS":            { areaId: "n2_egresos",        piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE DEUDA PÚBLICA":                { areaId: "n2_egresos",        piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE FIDEICOMISOS PÚBLICOS":        { areaId: "n2_egresos",        piso: PisoEdificio.NIVEL_2 },
  "DIRECCIÓN DE PRESUPUESTO":                     { areaId: "n2_egresos",        piso: PisoEdificio.NIVEL_2 },
  "DIRECCION DE PRESUPUESTO":                     { areaId: "n2_egresos",        piso: PisoEdificio.NIVEL_2 },
  "COORDINACIÓN DE GESTIÓN PRESUPUESTARIA":       { areaId: "n2_egresos",        piso: PisoEdificio.NIVEL_2 },
  "COORDINACIÓN DE CONTROL FINANCIERO":           { areaId: "n2_egresos",        piso: PisoEdificio.NIVEL_2 },
  "COORDINACIÓN DE PROCESAMIENTO DE CUENTAS POR LIQUIDAR CERTIFICADAS Y SEGUIMIENTO PRESUPUESTARIO A GASTO DE OPERACIÓN": { areaId: "n2_egresos", piso: PisoEdificio.NIVEL_2 },
  "COORDINACIÓN DE MONITOREO DEL GASTO":          { areaId: "n2_egresos",        piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE SEGUIMIENTO PRESUPUESTARIO A GASTO DE OPERACIÓN": { areaId: "n2_egresos", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE GESTIÓN PRESUPUESTARIA \"A\"": { areaId: "n2_egresos",        piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE GESTIÓN PRESUPUESTARIA \"B\"": { areaId: "n2_egresos",        piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE PRESUPUESTO \"A\"":            { areaId: "n2_egresos",        piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE PRESUPUESTO \"B\"":            { areaId: "n2_egresos",        piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE POLÍTICA PRESUPUESTARIA":      { areaId: "n2_egresos",        piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE PLANEACIÓN Y EVALUACIÓN FINANCIERA": { areaId: "n2_egresos",  piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE PROGRAMACIÓN DE MINISTRACIONES Y PAGOS": { areaId: "n2_egresos", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE PROGRAMACIÓN FEDERAL Y ESTATAL": { areaId: "n2_egresos",      piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE PROGRAMACIóN FEDERAL Y ESTATAL": { areaId: "n2_egresos",      piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE PROGRAMAS FEDERALES":          { areaId: "n2_egresos",        piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE PROCEMIENTO DE CUENTAS POR LIQUIDAR CERTIFICADAS DE GASTO DE OPERACIÓN \"A\"": { areaId: "n2_egresos", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE PROCESAMIENTO DE CUENTAS POR LIQUIDAR CERTIFICADAS DE GASTO DE OPERACIÓN \"B\"": { areaId: "n2_egresos", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE PROCESAMIENTO DE CUENTAS POR LIQUIDAR CERTIFICADAS DE INVERSIÓN PÚBLICA": { areaId: "n2_egresos", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE PROCESAMIENTO Y ANÁLISIS DE LA INFORMACIÓN": { areaId: "n2_egresos", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE RECURSOS HUMANOS":             { areaId: "n2_nominas",        piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE CAPACITACIÓN Y ASISTENCIA TÉCNICA": { areaId: "n2_nominas",   piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE SEGUIMIENTO ADMINISTRATIVO":   { areaId: "n2_nominas",        piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE SERVICIOS GENERALES":          { areaId: "n2_almacen",        piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE RECURSOS MATERIALES":          { areaId: "n2_almacen",        piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE GESTIÓN Y CONTROL DE FORMAS OFICIALES VALORADAS": { areaId: "n2_almacen", piso: PisoEdificio.NIVEL_2 },
};

// ============================================================
// Helpers internos
// ============================================================

function mapearArea(departamento: string | undefined): AreaMapping {
  if (!departamento) return FALLBACK;
  return DEPT_TO_AREA[departamento] ?? FALLBACK;
}

function buildEmpleadoData(emp: SirhEmpleado) {
  const rfc = (emp.RFC ?? "").toUpperCase().trim();
  const nombre = (emp.NOMBRES ?? "").trim();
  const apePat = (emp.APE_PAT ?? "").trim();
  const apeMat = (emp.APE_MAT ?? "").trim();
  const apellidos = [apePat, apeMat].filter(Boolean).join(" ");
  const nombreCompleto = [nombre, apellidos].filter(Boolean).join(" ");
  const departamento = (emp.DEPARTAMENTO ?? "").trim() || undefined;
  const puesto = (emp.NOMCATE ?? "").trim() || undefined;
  const email = emp.EMAIL ? emp.EMAIL.trim() || undefined : undefined;
  const { areaId, piso } = mapearArea(emp.DEPARTAMENTO);

  const adscripcion = (emp.ADSCRIPCION ?? "").trim() || undefined;

  return { rfc, nombre, apellidos, nombreCompleto, departamento, adscripcion, puesto, email, areaId, piso };
}

async function upsertEmpleado(data: ReturnType<typeof buildEmpleadoData>): Promise<"created" | "updated"> {
  const existe = await prisma.empleado.findUnique({ where: { rfc: data.rfc } });
  if (existe) {
    await prisma.empleado.update({
      where: { rfc: data.rfc },
      data: { ...data, sincronizadoSIRH: true, activo: true },
    });
    return "updated";
  }
  await prisma.empleado.create({
    data: { ...data, sincronizadoSIRH: true, activo: true },
  });
  return "created";
}

// ============================================================
// Fetch todos los empleados desde SIRH
// ============================================================

export async function fetchAllEmployees(): Promise<SirhEmpleado[]> {
  const resp = await fetch(SIRH_URL, { signal: AbortSignal.timeout(15_000) });
  if (!resp.ok) {
    throw new Error(`SIRH respondio ${resp.status} ${resp.statusText}`);
  }
  return resp.json() as Promise<SirhEmpleado[]>;
}

// ============================================================
// Sincronización completa — llamada al arrancar la API
// ============================================================

export async function syncEmpleados(): Promise<void> {
  if (!SIRH_ENABLED) return;

  console.log("[SIRH] Iniciando sincronizacion de empleados...");
  console.log(`[SIRH] URL: ${SIRH_URL}`);

  let todos: SirhEmpleado[];
  try {
    todos = await fetchAllEmployees();
  } catch (err) {
    console.error("[SIRH] No se pudo conectar con SIRH — sync omitida:", (err as Error).message);
    return;
  }

  console.log(`[SIRH] Registros recibidos: ${todos.length}`);

  const validos = todos.filter((e) => e.RFC && e.RFC.length === 13 && e.status === 1);
  console.log(`[SIRH] Validos (RFC=13, status=1): ${validos.length}`);

  let creados = 0;
  let actualizados = 0;
  let errores = 0;

  for (const emp of validos) {
    try {
      const result = await upsertEmpleado(buildEmpleadoData(emp));
      if (result === "created") creados++;
      else actualizados++;
    } catch (err) {
      errores++;
      console.error(`[SIRH] Error con RFC ${emp.RFC}:`, (err as Error).message);
    }
  }

  console.log(
    `[SIRH] Sync completada — creados: ${creados}, actualizados: ${actualizados}, errores: ${errores}`,
  );
}

// ============================================================
// Búsqueda individual por RFC — llamada en login-rfc
// ============================================================

export async function fetchEmpleadoByRfc(rfc: string): Promise<boolean> {
  if (!SIRH_ENABLED) return false;

  let todos: SirhEmpleado[];
  try {
    todos = await fetchAllEmployees();
  } catch (err) {
    console.warn(`[SIRH] No se pudo consultar SIRH para RFC ${rfc}:`, (err as Error).message);
    return false;
  }

  const rfcUp = rfc.toUpperCase().trim();
  const emp = todos.find((e) => e.RFC?.toUpperCase().trim() === rfcUp && e.status === 1);

  if (!emp) {
    console.log(`[SIRH] RFC ${rfcUp} no encontrado en SIRH`);
    return false;
  }

  try {
    const result = await upsertEmpleado(buildEmpleadoData(emp));
    console.log(`[SIRH] RFC ${rfcUp} ${result === "created" ? "importado desde SIRH" : "actualizado desde SIRH"}`);
    return true;
  } catch (err) {
    console.error(`[SIRH] Error al guardar RFC ${rfcUp}:`, (err as Error).message);
    return false;
  }
}
