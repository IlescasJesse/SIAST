import { PrismaClient, SubcategoriaTicket } from "@prisma/client";

/**
 * Tipo local — equivalente al ProcesoInfo eliminado de @stf/shared.
 * seed_procesos.ts es autónomo: no depende de ningún export de @stf/shared.
 */
type ProcesoSeedInfo = {
  nombre: string;
  tipoFlujo: "DIRECTO" | "SECUENCIAL" | "PENDIENTE";
  descripcion?: string;
  pasos: Array<{
    orden: number;
    rolRequerido: string;
    nombre: string;
    descripcion?: string;
    registraUnidades?: boolean;
    labelUnidades?: string;
  }>;
};

/**
 * Mapa local de procesos — clave: "SUBCATEGORIA" o "SUBCATEGORIA:SUBTIPO".
 * Refleja exactamente el antiguo PROCESO_MAP de @stf/shared.
 */
const PROCESO_SEED_MAP: Record<string, ProcesoSeedInfo> = {
  // EQUIPOS_DISPOSITIVOS
  "EQUIPOS_DISPOSITIVOS:EQUIPO_NUEVO_CON_RED": {
    nombre: "Equipo nuevo / configuración inicial (con red)",
    tipoFlujo: "SECUENCIAL",
    pasos: [
      { orden: 1, rolRequerido: "TECNICO_TI", nombre: "Configuración de equipo por Soporte TI" },
      { orden: 2, rolRequerido: "TECNICO_REDES", nombre: "Alta en red por Redes" },
    ],
  },
  "EQUIPOS_DISPOSITIVOS:EQUIPO_NUEVO_SIN_RED": {
    nombre: "Equipo nuevo / configuración inicial (sin red)",
    tipoFlujo: "DIRECTO",
    pasos: [
      { orden: 1, rolRequerido: "TECNICO_TI", nombre: "Configuración de equipo por Soporte TI" },
    ],
  },
  "EQUIPOS_DISPOSITIVOS:REINSTALACION_FORMATEO": {
    nombre: "Reinstalación y formateo",
    tipoFlujo: "SECUENCIAL",
    pasos: [
      { orden: 1, rolRequerido: "TECNICO_TI", nombre: "Reinstalación / formateo por Soporte TI" },
      { orden: 2, rolRequerido: "TECNICO_REDES", nombre: "Alta en red por Redes" },
    ],
  },
  "EQUIPOS_DISPOSITIVOS:FALLA_IMPRESORA": {
    nombre: "Falla de impresora",
    tipoFlujo: "DIRECTO",
    pasos: [
      { orden: 1, rolRequerido: "TECNICO_TI", nombre: "Diagnóstico y reparación por Soporte TI" },
    ],
  },
  "EQUIPOS_DISPOSITIVOS:INSTALAR_SOFTWARE": {
    nombre: "Instalación de software",
    tipoFlujo: "DIRECTO",
    pasos: [
      { orden: 1, rolRequerido: "TECNICO_TI", nombre: "Instalación de software por Soporte TI" },
    ],
  },
  "EQUIPOS_DISPOSITIVOS:IMPRESORA_NUEVA_EN_RED": {
    nombre: "Impresora nueva en red",
    tipoFlujo: "SECUENCIAL",
    descripcion:
      "Redes agrega la impresora a la red; Soporte TI instala controladores en cada PC que la requiera. Cada PC instalada cuenta como unidad de servicio.",
    pasos: [
      { orden: 1, rolRequerido: "TECNICO_REDES", nombre: "Alta de impresora en red por Redes" },
      {
        orden: 2,
        rolRequerido: "TECNICO_TI",
        nombre: "Instalación de controladores en PCs",
        descripcion:
          "Soporte TI instala la impresora en cada PC que la requiera. Registrar el número de PCs atendidas.",
        registraUnidades: true,
        labelUnidades: "PCs con impresora instalada",
      },
    ],
  },
  "EQUIPOS_DISPOSITIVOS:MANTENIMIENTO_PREVENTIVO": {
    nombre: "Mantenimiento preventivo",
    tipoFlujo: "DIRECTO",
    pasos: [
      { orden: 1, rolRequerido: "TECNICO_TI", nombre: "Mantenimiento preventivo por Soporte TI" },
    ],
  },
  "EQUIPOS_DISPOSITIVOS:MANTENIMIENTO_CORRECTIVO": {
    nombre: "Mantenimiento correctivo",
    tipoFlujo: "DIRECTO",
    descripcion:
      "Si se requiere pieza de repuesto o garantía, escala a Recursos Materiales (pendiente de vincular).",
    pasos: [
      {
        orden: 1,
        rolRequerido: "TECNICO_TI",
        nombre: "Diagnóstico y reparación correctiva por Soporte TI",
      },
    ],
  },
  // RED_INTERNET
  "RED_INTERNET:SIN_ACCESO_INTERNET": {
    nombre: "Sin acceso a internet",
    tipoFlujo: "DIRECTO",
    pasos: [
      { orden: 1, rolRequerido: "TECNICO_REDES", nombre: "Diagnóstico y restauración de acceso por Redes" },
    ],
  },
  "RED_INTERNET:SOLICITUD_ACCESO_INTERNET": {
    nombre: "Solicitud de acceso a internet",
    tipoFlujo: "DIRECTO",
    pasos: [{ orden: 1, rolRequerido: "TECNICO_REDES", nombre: "Alta de acceso a internet por Redes" }],
  },
  "RED_INTERNET:SOPORTE_DOMINIO": {
    nombre: "Soporte sobre dominio",
    tipoFlujo: "DIRECTO",
    pasos: [{ orden: 1, rolRequerido: "TECNICO_REDES", nombre: "Soporte de dominio por Redes" }],
  },
  // CUENTAS_DOMINIO
  "CUENTAS_DOMINIO:CREACION_USUARIO": {
    nombre: "Creación de usuario de dominio",
    tipoFlujo: "DIRECTO",
    pasos: [{ orden: 1, rolRequerido: "TECNICO_REDES", nombre: "Creación de usuario de dominio por Redes" }],
  },
  // RED_INTERNET — fallback subcategoría completa (sin subTipo)
  RED_INTERNET: {
    nombre: "Red / Internet",
    tipoFlujo: "DIRECTO",
    pasos: [{ orden: 1, rolRequerido: "TECNICO_REDES", nombre: "Atención por Redes" }],
  },
  // CUENTAS_DOMINIO — fallback subcategoría completa (sin subTipo)
  CUENTAS_DOMINIO: {
    nombre: "Cuentas y dominio",
    tipoFlujo: "DIRECTO",
    pasos: [{ orden: 1, rolRequerido: "TECNICO_REDES", nombre: "Gestión de cuenta/dominio por Redes" }],
  },
  // CORREO_OUTLOOK (toda la subcategoría, nivel cliente)
  CORREO_OUTLOOK: {
    nombre: "Soporte Correo Outlook (cliente)",
    tipoFlujo: "DIRECTO",
    descripcion:
      "Configuración y soporte del cliente Outlook en el equipo del usuario. No involucra servidor/Exchange.",
    pasos: [
      {
        orden: 1,
        rolRequerido: "TECNICO_TI",
        nombre: "Configuración/soporte de cliente Outlook por Soporte TI",
      },
    ],
  },
  // SISTEMAS_INSTITUCIONALES — flujo DIRECTO con 1 paso TECNICO_TI
  "SISTEMAS_INSTITUCIONALES:SIRH": {
    nombre: "Soporte SIRH",
    tipoFlujo: "DIRECTO",
    descripcion: "Atención de soporte técnico para el sistema SIRH.",
    pasos: [
      {
        orden: 1,
        rolRequerido: "TECNICO_TI",
        nombre: "Atención por Soporte TI",
        descripcion: "Atención directa por técnico TI al usuario del SIRH.",
        registraUnidades: false,
      },
    ],
  },
  "SISTEMAS_INSTITUCIONALES:SIAST": {
    nombre: "Soporte SIAST",
    tipoFlujo: "DIRECTO",
    descripcion: "Atención de soporte técnico para el sistema SIAST.",
    pasos: [
      {
        orden: 1,
        rolRequerido: "TECNICO_TI",
        nombre: "Atención por Soporte TI",
        descripcion: "Atención directa por técnico TI al usuario del SIAST.",
        registraUnidades: false,
      },
    ],
  },
  // ── Phase 3: MANTENIMIENTO (SERVICIOS) ─────────────────────────────
  SANITARIOS: {
    nombre: "Sanitarios y plomería",
    tipoFlujo: "DIRECTO",
    pasos: [
      { orden: 1, rolRequerido: "TECNICO_PLOMERO", nombre: "Atención por Técnico Plomero" },
    ],
  },
  ILUMINACION: {
    nombre: "Iluminación y electricidad",
    tipoFlujo: "DIRECTO",
    pasos: [
      { orden: 1, rolRequerido: "TECNICO_ELECTRICISTA", nombre: "Atención por Técnico Electricista" },
    ],
  },
  MOVILIDAD: {
    nombre: "Movilidad y accesibilidad",
    tipoFlujo: "DIRECTO",
    pasos: [
      { orden: 1, rolRequerido: "TECNICO_MOVILIDAD", nombre: "Atención por Técnico de Movilidad" },
    ],
  },
};

/**
 * Siembra (upsert idempotente) todos los procesos de flujo multi-paso
 * definidos en PROCESO_SEED_MAP en las tablas:
 *   - procesos_definicion
 *   - pasos_definicion
 *
 * Se puede llamar desde el seed principal o ejecutarse de forma independiente:
 *   npx tsx packages/database/prisma/seed_procesos.ts
 */
export async function seedProcesos(prisma: PrismaClient): Promise<void> {
  console.log("Sembrando procesos de flujo (ProcesoDefinicion + PasoDefinicion)...");

  for (const [key, procesoInfo] of Object.entries(PROCESO_SEED_MAP)) {
    // Descomponer la clave "SUBCATEGORIA" o "SUBCATEGORIA:SUBTIPO"
    const colonIdx = key.indexOf(":");
    const subcategoria = (colonIdx === -1 ? key : key.slice(0, colonIdx)) as SubcategoriaTicket;
    const subTipo = colonIdx === -1 ? null : key.slice(colonIdx + 1);

    // Prisma no admite upsert con un campo nullable como parte de la clave única
    // (@@unique([subcategoria, subTipo])) cuando subTipo es null.
    // Usamos findFirst + update/create para ese caso.
    const existing = await prisma.procesoDefinicion.findFirst({
      where: { subcategoria, subTipo: subTipo ?? null },
    });

    let procesoId: number;

    if (existing) {
      // Actualizar datos del proceso
      await prisma.procesoDefinicion.update({
        where: { id: existing.id },
        data: {
          tipoFlujo: procesoInfo.tipoFlujo,
          nombre: procesoInfo.nombre,
          descripcion: procesoInfo.descripcion ?? null,
          activo: true,
        },
      });
      procesoId = existing.id;

      // Eliminar pasos previos para re-crearlos frescos
      await prisma.pasoDefinicion.deleteMany({ where: { procesoId } });
    } else {
      // Crear proceso nuevo
      const created = await prisma.procesoDefinicion.create({
        data: {
          subcategoria,
          subTipo: subTipo ?? null,
          tipoFlujo: procesoInfo.tipoFlujo,
          nombre: procesoInfo.nombre,
          descripcion: procesoInfo.descripcion ?? null,
          activo: true,
        },
      });
      procesoId = created.id;
    }

    // Crear pasos del proceso
    for (const paso of procesoInfo.pasos) {
      await prisma.pasoDefinicion.create({
        data: {
          procesoId,
          orden: paso.orden,
          rolRequerido: paso.rolRequerido,
          nombre: paso.nombre,
          descripcion: paso.descripcion ?? null,
          registraUnidades: paso.registraUnidades ?? false,
          labelUnidades: paso.labelUnidades ?? null,
        },
      });
    }

    const subLabel = subTipo ? `:${subTipo}` : "";
    console.log(
      `  [${existing ? "UPDATED" : "CREATED"}] ${subcategoria}${subLabel} — "${procesoInfo.nombre}" (${procesoInfo.pasos.length} paso(s))`,
    );
  }

  const total = Object.keys(PROCESO_SEED_MAP).length;
  console.log(`Procesos sembrados: ${total} proceso(s) listos.`);
}

// Permite ejecutar este archivo de forma independiente
if (process.argv[1] && process.argv[1].includes("seed_procesos")) {
  const prisma = new PrismaClient();
  seedProcesos(prisma)
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}
