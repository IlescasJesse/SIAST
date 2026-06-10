export const meta = {
  name: "pre-deploy",
  description:
    "Gate de deploy SIAST: typecheck + lint + revisión adversarial + auditoría de seguridad",
  whenToUse: "Antes de subir al VPS, cerrar un milestone, o cuando Jesse pida validación completa",
  phases: [
    { title: "Estática", detail: "tsc + lint en paralelo" },
    { title: "Revisión", detail: "revision-completa (sub-workflow)" },
    { title: "Seguridad", detail: "checklist gubernamental OTP/JWT/CORS/soft-delete" },
  ],
};

const SCOPE =
  args && typeof args === "string" ? args : "cambios recientes (git diff HEAD~10) y apps/api";

phase("Estática");
const [typecheck, lint] = await parallel([
  () =>
    agent(
      "En el monorepo SIAST (directorio actual): ejecuta `npx tsc --noEmit` dentro de apps/api. " +
        'Reporta SOLO errores con archivo:línea, o "TYPECHECK OK" si pasa limpio.',
      { label: "typecheck", phase: "Estática", model: "haiku" },
    ),
  () =>
    agent(
      "En la raíz del monorepo SIAST ejecuta `npm run lint`. " +
        'Reporta SOLO errores y warnings accionables con archivo:línea, o "LINT OK" si pasa limpio.',
      { label: "lint", phase: "Estática", model: "haiku" },
    ),
]);

phase("Revisión");
const revision = await workflow("revision-completa", SCOPE);

phase("Seguridad");
const seguridad = await agent(
  `Audita seguridad de SIAST, alcance: ${SCOPE}. Sigue tu checklist completo: ` +
    "OTP (exposición, hash, expiración), JWT (secret en .env, claims, verificación por ruta), " +
    "CORS (whitelist), inputs Zod, secrets hardcodeados, middleware de roles (RESPONSABLE_* limitado a su areaSoporteId), " +
    "soft delete (queries con activo:true), npm audit críticos/altos. " +
    "Devuelve tu formato fijo: Resumen, tabla de Hallazgos con severidad y fix propuesto, Verificados sin problema, Siguiente paso.",
  { label: "revisor-seguridad", phase: "Seguridad", agentType: "revisor-seguridad" },
);

log("Gate completo — consolidando veredicto");
return {
  typecheck,
  lint,
  hallazgosConfirmados: revision?.confirmados || [],
  auditoriaSeguridad: seguridad,
};
