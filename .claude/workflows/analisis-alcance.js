export const meta = {
  name: 'analisis-alcance',
  description: 'Análisis paralelo de alcance de sesión SIAST: estado GSD, vault, monorepo, pendientes → mapa + plan',
  whenToUse: 'Al inicio de sesión o cuando Jesse pide situarse / analizar alcance',
  phases: [
    { title: 'Explorar', detail: '4 lectores paralelos' },
    { title: 'Sintetizar', detail: 'mapa de alcance + plan de delegación' },
  ],
}

const FOCUS = args && typeof args === 'string' ? args : 'estado general del proyecto'

phase('Explorar')
const lecturas = await parallel([
  () => agent(
    'Proyecto SIAST en el directorio actual. Reporta: salida de `git log --oneline -15` y `git status`, ' +
    'y contenido de .planning/STATE.md (GSD activo). Devuelve datos crudos resumidos, sin opinar.',
    { label: 'estado-git-gsd', phase: 'Explorar', model: 'haiku' }
  ),
  () => agent(
    'Lee ~/DevVault/01-Projects/SIAST/README.md completo y las últimas 15 líneas de ' +
    '~/DevVault/Decisions/DECISIONS.md. Extrae: estado según vault, decisiones que afecten a SIAST. Resumen denso.',
    { label: 'vault', phase: 'Explorar', model: 'haiku' }
  ),
  () => agent(
    `Explora el monorepo SIAST relevante a: "${FOCUS}". ` +
    'Workspaces: apps/api (Express 5101), apps/web (Vite/React/MUI v6, 5173), apps/modelado-3d (Three.js, 5174), ' +
    'packages/{shared,ui,database}. Devuelve: archivos clave, estado de esa área, deuda visible. ' +
    'Ojo: backend usa mock data en memoria — migración a Prisma+MySQL es roadmap.',
    { label: 'codebase', phase: 'Explorar', model: 'sonnet' }
  ),
  () => agent(
    'Busca en SIAST (directorio actual, excluye node_modules): TODOs, FIXMEs, archivos sin commitear. Lista priorizada corta.',
    { label: 'pendientes', phase: 'Explorar', model: 'haiku' }
  ),
])

phase('Sintetizar')
const mapa = await agent(
  'Eres el orquestador de SIAST (sistema gubernamental, Sec. Finanzas Oaxaca — datos fiscales, auth RFC sin password, máx 2 tickets activos, soft delete). ' +
  `Foco de la sesión: "${FOCUS}". Con estos hallazgos:\n\n` +
  lecturas.filter(Boolean).join('\n\n---\n\n') +
  '\n\nProduce: ## Alcance detectado (2-3 líneas) · ## Riesgos/contexto gubernamental · ' +
  '## Plan de delegación (tabla: tarea | subagente de [senior-programacion, analizador-db, modelado-3d] | modelo de [haiku, sonnet, opus, fable]) · ' +
  '## Siguiente paso recomendado (UNA acción). Español, denso.',
  { label: 'sintesis', phase: 'Sintetizar', model: 'opus' }
)

return mapa
