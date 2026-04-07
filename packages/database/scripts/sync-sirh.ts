/**
 * sync-sirh.ts
 * Sincroniza los empleados del SIRH (localhost:3000/api/personal/getEmployees)
 * con la tabla `empleados` de siast_db.
 *
 * Uso:
 *   cd packages/database
 *   npx tsx scripts/sync-sirh.ts
 */

import { PrismaClient, PisoEdificio } from "@prisma/client";

const prisma = new PrismaClient();

const SIRH_URL = "http://localhost:3000/api/personal/getEmployees";

// ============================================================
// Mapeo DEPARTAMENTO (SIRH) → { areaId, piso } (SIAST)
// Empleados sin mapeo explícito caen en FALLBACK.
// ============================================================

interface AreaMapping {
  areaId: string;
  piso: PisoEdificio;
}

const FALLBACK: AreaMapping = { areaId: "n3_nivel3_general", piso: PisoEdificio.NIVEL_3 };

const DEPT_TO_AREA: Record<string, AreaMapping> = {
  // ─── PLANTA BAJA ────────────────────────────────────────────
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
  "MODULO DE ATENCIÓN AL CONTRIBUYENTE DE OAXACA DE JUAREZ":   { areaId: "pb_atencion_ciudadana", piso: PisoEdificio.PB },
  "MóDULO DE ATENCIóN AL CONTRIBUYENTE DE OAXACA DE JUáREZ":  { areaId: "pb_atencion_ciudadana", piso: PisoEdificio.PB },
  "DEPARTAMENTO DE ENLACE Y COMUNICACIÓN": { areaId: "pb_atencion_ciudadana",   piso: PisoEdificio.PB },
  "DEPARTAMENTO DE ENLACE Y VERIFICACIÓN": { areaId: "pb_atencion_ciudadana",   piso: PisoEdificio.PB },

  // ─── NIVEL 1 ────────────────────────────────────────────────
  "OFICINA DEL SECRETARIO":                    { areaId: "n1_secretaria",       piso: PisoEdificio.NIVEL_1 },
  "SECRETARIO DE FINANZAS":                    { areaId: "n1_secretaria",       piso: PisoEdificio.NIVEL_1 },
  "ASESORÍA":                                  { areaId: "n1_secretaria",       piso: PisoEdificio.NIVEL_1 },
  "COORDINACIÓN DE GIRAS Y PROTOCOLO":         { areaId: "n1_secretaria",       piso: PisoEdificio.NIVEL_1 },
  "DEPARTAMENTO DE PLANEACIÓN DE GIRAS":       { areaId: "n1_secretaria",       piso: PisoEdificio.NIVEL_1 },
  "DEPARTAMENTO DE PROTOCOLO Y LOGÍSTICA":     { areaId: "n1_secretaria",       piso: PisoEdificio.NIVEL_1 },
  "PERSONAL ADSCRITO A LA SECRETARÍA DE FINANZAS (HANGAR)": { areaId: "n1_secretaria", piso: PisoEdificio.NIVEL_1 },
  "CASA OFICIAL DE GOBIERNO":                  { areaId: "n1_secretaria",       piso: PisoEdificio.NIVEL_1 },
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

  // ─── NIVEL 2 ────────────────────────────────────────────────
  "OTORGAMIENTO DE SERVICIOS ADMINISTRATIVOS(DIRECCIÓN DE TECNOLOGÍAS DE LA INFORMACIÓN)": { areaId: "n2_informatica", piso: PisoEdificio.NIVEL_2 },
  // Recaudación
  "DEPARTAMENTO DE ADMINISTRACIÓN TRIBUTARIA":    { areaId: "n2_recaudacion",   piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE ADMINISTRACIóN TRIBUTARIA":    { areaId: "n2_recaudacion",   piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE ADMINISTRACION TRIBUTARIA":    { areaId: "n2_recaudacion",   piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE REGISTRO Y CONTROL DE CRÉDITOS": { areaId: "n2_recaudacion", piso: PisoEdificio.NIVEL_2 },
  "COORDINACIÓN DE COBRO COACTIVO":               { areaId: "n2_recaudacion",   piso: PisoEdificio.NIVEL_2 },
  "COORDINACIóN DE COBRO COACTIVO":               { areaId: "n2_recaudacion",   piso: PisoEdificio.NIVEL_2 },
  "COORDINACIÓN DE VISITAS DOMICILIARIAS":        { areaId: "n2_recaudacion",   piso: PisoEdificio.NIVEL_2 },
  "COORDINACIÓN DE REVISIÓN DE GABINETE Y MASIVA":  { areaId: "n2_recaudacion", piso: PisoEdificio.NIVEL_2 },
  "COORDINACIóN DE REVISIÓN DE GABINETE Y MASIVA":  { areaId: "n2_recaudacion", piso: PisoEdificio.NIVEL_2 },
  "COORDINACIóN DE REVISIóN DE GABINETE Y MASIVA":  { areaId: "n2_recaudacion", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE REVISIÓN DE GABINETE":         { areaId: "n2_recaudacion",   piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE VERIFICACIÓN Y REVISIÓN DE MASIVAS": { areaId: "n2_recaudacion", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE VERIFICACIóN Y REVISIóN DE MASIVAS": { areaId: "n2_recaudacion", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE CONTROL DE OBLIGACIONES":      { areaId: "n2_recaudacion",   piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE REVISIÓN DE DICTÁMENES":       { areaId: "n2_recaudacion",   piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE REVISIóN DE DICTáMENES":       { areaId: "n2_recaudacion",   piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE CONSULTAS, SOLICITUDES Y NOTIFICACIONES": { areaId: "n2_recaudacion", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE CONSULTAS SOLICITUDES Y NOTIFICACIONES":  { areaId: "n2_recaudacion", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE REVISIÓN A RENGLONES ESPECÍFICOS": { areaId: "n2_recaudacion", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE REVISIóN A RENGLONES ESPECíFICOS": { areaId: "n2_recaudacion", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE AUDITORÍAS A PERSONAS FÍSICAS":   { areaId: "n2_recaudacion", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE AUDITORÍAS A PERSONAS MORALES":   { areaId: "n2_recaudacion", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE CONTROL Y EJECUCIÓN DE CRÉDITOS": { areaId: "n2_recaudacion", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE SEGUIMIENTO DE CRÉDITOS":      { areaId: "n2_recaudacion",   piso: PisoEdificio.NIVEL_2 },
  "DIRECCIÓN DE INGRESOS Y RECAUDACIÓN":          { areaId: "n2_recaudacion",   piso: PisoEdificio.NIVEL_2 },
  // Contraloría
  "DIRECCIÓN DE AUDITORÍA E INSPECCIÓN FISCAL":   { areaId: "n2_contraloria",   piso: PisoEdificio.NIVEL_2 },
  "COORDINACIÓN DE AUDITORÍAS, ARMONIZACIÓN CONTABLE Y FINANCIERA": { areaId: "n2_contraloria", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE REVISIÓN Y ANÁLISIS DEL SECTOR CENTRAL":   { areaId: "n2_contraloria", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE REVISIÓN Y ANÁLISIS DEL SECTOR PARAESTATAL": { areaId: "n2_contraloria", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE ANÁLISIS Y ARMONIZACIÓN CONTABLE":          { areaId: "n2_contraloria", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE REVISIÓN Y ANÁLISIS CONTABLE DE LOS INGRESOS": { areaId: "n2_contraloria", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE ATENCIÓN Y SEGUIMIENTO A LOS PROCESOS DE AUDITORÍAS": { areaId: "n2_contraloria", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE REVISIÓN FINANCIERA":          { areaId: "n2_contraloria",   piso: PisoEdificio.NIVEL_2 },
  // Egresos / Presupuesto
  "DIRECCIÓN DE CONTABILIDAD GUBERNAMENTAL":      { areaId: "n2_egresos",       piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE RECURSOS FINANCIEROS":         { areaId: "n2_egresos",       piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE CONTROL DE FONDOS":            { areaId: "n2_egresos",       piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE DEUDA PÚBLICA":                { areaId: "n2_egresos",       piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE FIDEICOMISOS PÚBLICOS":        { areaId: "n2_egresos",       piso: PisoEdificio.NIVEL_2 },
  "DIRECCIÓN DE PRESUPUESTO":                     { areaId: "n2_egresos",       piso: PisoEdificio.NIVEL_2 },
  "DIRECCION DE PRESUPUESTO":                     { areaId: "n2_egresos",       piso: PisoEdificio.NIVEL_2 },
  "COORDINACIÓN DE GESTIÓN PRESUPUESTARIA":       { areaId: "n2_egresos",       piso: PisoEdificio.NIVEL_2 },
  "COORDINACIÓN DE CONTROL FINANCIERO":           { areaId: "n2_egresos",       piso: PisoEdificio.NIVEL_2 },
  "COORDINACIÓN DE PROCESAMIENTO DE CUENTAS POR LIQUIDAR CERTIFICADAS Y SEGUIMIENTO PRESUPUESTARIO A GASTO DE OPERACIÓN": { areaId: "n2_egresos", piso: PisoEdificio.NIVEL_2 },
  "COORDINACIÓN DE MONITOREO DEL GASTO":          { areaId: "n2_egresos",       piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE SEGUIMIENTO PRESUPUESTARIO A GASTO DE OPERACIÓN": { areaId: "n2_egresos", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE GESTIÓN PRESUPUESTARIA \"A\"": { areaId: "n2_egresos",       piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE GESTIÓN PRESUPUESTARIA \"B\"": { areaId: "n2_egresos",       piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE PRESUPUESTO \"A\"":            { areaId: "n2_egresos",       piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE PRESUPUESTO \"B\"":            { areaId: "n2_egresos",       piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE POLÍTICA PRESUPUESTARIA":      { areaId: "n2_egresos",       piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE PLANEACIÓN Y EVALUACIÓN FINANCIERA": { areaId: "n2_egresos", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE PROGRAMACIÓN DE MINISTRACIONES Y PAGOS": { areaId: "n2_egresos", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE PROGRAMACIÓN FEDERAL Y ESTATAL": { areaId: "n2_egresos",     piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE PROGRAMACIóN FEDERAL Y ESTATAL": { areaId: "n2_egresos",     piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE PROGRAMAS FEDERALES":          { areaId: "n2_egresos",       piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE CONTROL DE FONDOS":            { areaId: "n2_egresos",       piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE PROCEMIENTO DE CUENTAS POR LIQUIDAR CERTIFICADAS DE GASTO DE OPERACIÓN \"A\"": { areaId: "n2_egresos", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE PROCESAMIENTO DE CUENTAS POR LIQUIDAR CERTIFICADAS DE GASTO DE OPERACIÓN \"B\"": { areaId: "n2_egresos", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE PROCESAMIENTO DE CUENTAS POR LIQUIDAR CERTIFICADAS DE INVERSIÓN PÚBLICA": { areaId: "n2_egresos", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE PROCESAMIENTO Y ANÁLISIS DE LA INFORMACIÓN": { areaId: "n2_egresos", piso: PisoEdificio.NIVEL_2 },
  // Nóminas / RRHH
  "DEPARTAMENTO DE RECURSOS HUMANOS":             { areaId: "n2_nominas",       piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE CAPACITACIÓN Y ASISTENCIA TÉCNICA": { areaId: "n2_nominas", piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE SEGUIMIENTO ADMINISTRATIVO":   { areaId: "n2_nominas",       piso: PisoEdificio.NIVEL_2 },
  // Almacén / Servicios Generales
  "DEPARTAMENTO DE SERVICIOS GENERALES":          { areaId: "n2_almacen",       piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE RECURSOS MATERIALES":          { areaId: "n2_almacen",       piso: PisoEdificio.NIVEL_2 },
  "DEPARTAMENTO DE GESTIÓN Y CONTROL DE FORMAS OFICIALES VALORADAS": { areaId: "n2_almacen", piso: PisoEdificio.NIVEL_2 },
};

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

function mapearArea(departamento: string | undefined): AreaMapping {
  if (!departamento) return FALLBACK;
  return DEPT_TO_AREA[departamento] ?? FALLBACK;
}

async function main() {
  console.log("🔄 Sincronizando empleados desde SIRH...");
  console.log(`   URL: ${SIRH_URL}\n`);

  // 1. Fetch SIRH
  const resp = await fetch(SIRH_URL);
  if (!resp.ok) {
    throw new Error(`Error al conectar con SIRH: ${resp.status} ${resp.statusText}`);
  }
  const todos: SirhEmpleado[] = await resp.json();
  console.log(`📥 Total registros recibidos del SIRH: ${todos.length}`);

  // 2. Filtrar: RFC válido (13 chars) y status activo (1)
  const validos = todos.filter(
    (e) => e.RFC && e.RFC.length === 13 && e.status === 1,
  );
  console.log(`✅ Empleados válidos (RFC=13 chars, status=1): ${validos.length}`);
  console.log(
    `⚠️  Descartados (sin RFC / RFC inválido / inactivos): ${todos.length - validos.length}\n`,
  );

  // 3. Upsert en siast_db.empleados
  let creados = 0;
  let actualizados = 0;
  let errores = 0;

  for (const emp of validos) {
    const rfc = emp.RFC!.toUpperCase().trim();
    const nombre = (emp.NOMBRES ?? "").trim();
    const apePat = (emp.APE_PAT ?? "").trim();
    const apeMat = (emp.APE_MAT ?? "").trim();
    const apellidos = [apePat, apeMat].filter(Boolean).join(" ");
    const nombreCompleto = [nombre, apellidos].filter(Boolean).join(" ");
    const departamento = (emp.DEPARTAMENTO ?? "").trim() || undefined;
    const puesto = (emp.NOMCATE ?? "").trim() || undefined;
    const email = emp.EMAIL ? emp.EMAIL.trim() || undefined : undefined;

    const { areaId, piso } = mapearArea(emp.DEPARTAMENTO);

    try {
      const existe = await prisma.empleado.findUnique({ where: { rfc } });
      if (existe) {
        await prisma.empleado.update({
          where: { rfc },
          data: {
            nombre,
            apellidos,
            nombreCompleto,
            departamento,
            puesto,
            email,
            areaId,
            piso,
            sincronizadoSIRH: true,
            activo: true,
          },
        });
        actualizados++;
      } else {
        await prisma.empleado.create({
          data: {
            rfc,
            nombre,
            apellidos,
            nombreCompleto,
            departamento,
            puesto,
            email,
            areaId,
            piso,
            sincronizadoSIRH: true,
            activo: true,
          },
        });
        creados++;
      }
    } catch (err) {
      errores++;
      console.error(`  ❌ Error con RFC ${rfc}:`, (err as Error).message);
    }
  }

  console.log("─".repeat(50));
  console.log(`🎉 Sincronización completada:`);
  console.log(`   Creados:    ${creados}`);
  console.log(`   Actualizados: ${actualizados}`);
  console.log(`   Errores:    ${errores}`);
  console.log("─".repeat(50));

  // 4. Resumen por área
  const resumen = await prisma.empleado.groupBy({
    by: ["areaId"],
    where: { sincronizadoSIRH: true, activo: true },
    _count: { rfc: true },
    orderBy: { _count: { rfc: "desc" } },
  });
  console.log("\n📊 Distribución por área (empleados SIRH):");
  for (const r of resumen) {
    console.log(`   ${r.areaId.padEnd(30)} ${r._count.rfc}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
