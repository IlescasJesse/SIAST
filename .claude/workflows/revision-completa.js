export const meta = {
  name: 'revision-completa',
  description: 'Revisión multi-dimensión de SIAST con verificación adversarial: bugs, seguridad gubernamental, calidad monorepo',
  whenToUse: 'Antes de deploy, tras una fase GSD, o cuando Jesse pide revisión',
  phases: [
    { title: 'Revisar', detail: '3 dimensiones en paralelo' },
    { title: 'Verificar', detail: 'refutación adversarial por hallazgo' },
  ],
}

const SCOPE = args && typeof args === 'string' ? args : 'cambios recientes (git diff HEAD~5) y apps/api'

const FINDINGS = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          line: { type: 'number' },
          severity: { type: 'string', enum: ['alta', 'media', 'baja'] },
          title: { type: 'string' },
          detail: { type: 'string' },
        },
        required: ['file', 'severity', 'title', 'detail'],
        additionalProperties: false,
      },
    },
  },
  required: ['findings'],
  additionalProperties: false,
}

const VERDICT = {
  type: 'object',
  properties: {
    isReal: { type: 'boolean' },
    reason: { type: 'string' },
  },
  required: ['isReal', 'reason'],
  additionalProperties: false,
}

const DIMENSIONES = [
  { key: 'bugs', prompt: `Busca bugs de correctness en SIAST, alcance: ${SCOPE}. Monorepo apps/{api,web,modelado-3d} + packages/{shared,ui,database}. Reporta TODO hallazgo aunque dudes — filtro va después. Incluye severidad.` },
  { key: 'seguridad-gob', prompt: `Audita SIAST (gubernamental, datos fiscales), alcance: ${SCOPE}. Foco: auth empleados solo-RFC vs staff usuario+password, JWT, WhatsApp OTP (Meta Cloud API), regla máx 2 tickets activos, soft delete (activo=false), exposición de datos de funcionarios. Reporta todo hallazgo.` },
  { key: 'calidad', prompt: `Revisa calidad en SIAST, alcance: ${SCOPE}. Foco: tipos en packages/shared (referencias @stf/*), Zod en boundaries, convención MUI v6 en apps/web, Prettier (semi:true, doubleQuote, printWidth 100). Solo hallazgos que cambien comportamiento o rompan convención.` },
]

const resultados = await pipeline(
  DIMENSIONES,
  d => agent(d.prompt, { label: `rev:${d.key}`, phase: 'Revisar', schema: FINDINGS, model: 'sonnet' }),
  rev => parallel((rev?.findings || []).map(f => () =>
    agent(
      `Intenta REFUTAR este hallazgo en SIAST leyendo el código real: ${f.file}:${f.line || '?'} — ${f.title}. ${f.detail}. Si no puedes confirmarlo con evidencia, isReal=false.`,
      { label: `ver:${f.file}`, phase: 'Verificar', schema: VERDICT, model: 'haiku' }
    ).then(v => ({ ...f, verdict: v }))
  ))
)

const confirmados = resultados.flat().filter(Boolean).filter(f => f.verdict?.isReal)
log(`${confirmados.length} hallazgos confirmados`)
return { confirmados }
