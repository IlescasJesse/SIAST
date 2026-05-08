# Phase 1: Seguridad y Estabilidad - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-08
**Phase:** 1-Seguridad y Estabilidad
**Areas discussed:** OTP security scope, Rate limiting config, CORS allowlist

---

## OTP Security Scope

### Math.random() → crypto.randomInt()

| Option | Description | Selected |
|--------|-------------|----------|
| Sí, incluir | 1 línea en otp.service.ts, fix trivial, riesgo CSPRNG real | ✓ |
| No, solo SEC-02 | Defer Math.random(), solo remover devCodigo | |

**User's choice:** Incluir en esta fase

---

### Endpoint legacy /api/auth/login-rfc

Discusión extendida. Jesse preguntó cómo quedaría funcional sin el endpoint.
Explicación: el endpoint es un bypass que otorga JWT con solo RFC, sin OTP. El flujo OTP (`solicitar-otp` → `verificar-otp`) es el path activo — `loginRFC()` en el store nunca es llamado desde la UI activa.

| Option | Description | Selected |
|--------|-------------|----------|
| Eliminar limpio (A) | Borrar route + método loginRFC() del store | ✓ |
| Feature flag (B) | LEGACY_RFC_LOGIN=true env var | |
| No tocar (C) | Defer a Phase 2 | |

**User's choice:** Opción A — eliminación limpia
**Notes:** Jesse confirmó "situacion A decision A" tras recibir explicación del flujo OTP vigente.

---

### OTP en producción sin WhatsApp

| Option | Description | Selected |
|--------|-------------|----------|
| Fallar con 503 claro | 503 { error: "Servicio OTP no disponible. Contacte soporte." } | ✓ |
| Silenciar y dejar expirar | OTP generado pero nunca llega, mala UX | |

**User's choice:** 503 con mensaje claro

---

### Dev workflow sin WhatsApp

| Option | Description | Selected |
|--------|-------------|----------|
| Console.log del OTP | Imprime en terminal del servidor, simple, ya existe parcialmente | ✓ |
| Endpoint dev-only /api/dev/otp-peek | Más ergonómico pero añade código | |

**User's choice:** Console.log approach

---

### TTL del OTP

| Option | Description | Selected |
|--------|-------------|----------|
| 10 min (mantener actual) | Valor ya configurado, razonable para WhatsApp | ✓ |
| 5 min (más estricto) | Menor ventana de ataque, más re-solicitudes | |

**User's choice:** Mantener 10 min

---

## Rate Limiting Config

### Límites

| Option | Description | Selected |
|--------|-------------|----------|
| 5 intentos / 15 min | Estándar para OTP brute-force | ✓ |
| 10 intentos / 10 min | Más laxo, menos fricción | |
| 3 intentos / 30 min | Más estricto, más quejas de soporte | |

**User's choice:** 5 intentos / 15 min

---

### Por IP vs por RFC

| Option | Description | Selected |
|--------|-------------|----------|
| Por IP | Estándar express-rate-limit, sin código extra | ✓ |
| Por RFC | key personalizada, más preciso para este dominio | |
| Ambos (IP + RFC) | Doble capa, dos middlewares | |

**User's choice:** Por IP

---

### Configuración

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcodeados | Valor correcto y estable, sin complejidad extra | ✓ |
| Env vars RATE_LIMIT_MAX/WINDOW | Flexible sin redeploy | |

**User's choice:** Hardcodeados en código

---

### Bloqueos persistentes

Jesse preguntó sobre desbloquear IPs manualmente (quería UI admin para ello).
Explicación: express-rate-limit in-memory auto-expira en 15 min — no hay lista persistente que desbloquear.

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-expiry 15 min | Sin Redis, sin infraestructura extra | ✓ |
| Bloqueos persistentes con Redis | Sobrevive reinicios, requiere Redis en VPS | |

**User's choice:** Auto-expiry suficiente

---

## CORS Allowlist

### Fuente de orígenes

| Option | Description | Selected |
|--------|-------------|----------|
| Env var CORS_ORIGINS | Flexible sin redeploy | ✓ |
| Hardcodeados en index.ts | Simple, requiere redeploy para cambios | |

**User's choice:** Env var CORS_ORIGINS

---

### Puerto 5174 (visor 3D)

| Option | Description | Selected |
|--------|-------------|----------|
| Sí, incluir 5174 en dev | Visor 3D hace calls al API directamente | ✓ |
| Solo el frontend web (5173) | 3D en prod mismo dominio que web | |

**User's choice:** Incluir 5174 en dev

---

### Dominio de producción

| Option | Description | Selected |
|--------|-------------|----------|
| No definido aún | Placeholder en .env.example | ✓ |
| Ya tengo un dominio | (no seleccionado) | |

**User's choice:** No definido — documentar placeholder

---

### CORS_ORIGINS ausente al iniciar

| Option | Description | Selected |
|--------|-------------|----------|
| Error fatal, no arrancar | Consistente con JWT_SECRET (SEC-01) | ✓ |
| Warn + fallback localhost:5173 | Riesgo de olvidar en prod | |

**User's choice:** Error fatal — no arrancar sin CORS_ORIGINS

---

## Claude's Discretion

- Orden de validación de env vars en startup (JWT_SECRET vs CORS_ORIGINS primero)
- Formato exacto del mensaje en rate limit 429 response
- Identificación de qué archivos específicos son stale en `apps/web/src/components/Building3D/`

## Deferred Ideas

- **UI admin de desbloqueo de IPs:** Jesse quería poder desbloquear IPs manualmente. Con in-memory auto-expiry (15 min), no aplica. Si se migra a Redis en el futuro, revisar para fase de Admin avanzado.
