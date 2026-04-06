# 📋 SIAST — GUÍA DE DESPLIEGUE DE AGENTES EN CLAUDE CODE

## Sistema Integral de Atención y Soporte Técnico
### Secretaría de Finanzas — Gobierno del Estado de Oaxaca
### Edificio Saúl Martínez

---

## ORDEN DE LANZAMIENTO DE AGENTES

Lanza los agentes en este orden para evitar dependencias rotas:

```
1️⃣  AGENTE DATABASE    → genera el schema y hace la migración
2️⃣  AGENTE BACKEND     → implementa la API (requiere Prisma del paso 1)
3️⃣  AGENTE MODELADO 3D → construye el viewer Three.js
4️⃣  AGENTE FRONTEND    → construye la UI React (requiere backend + 3D viewer)
```

---

## PUERTOS

| Servicio | Puerto |
|----------|--------|
| Backend (Express) | `3001` |
| Frontend (React + Vite) | `5173` |
| Modelado 3D (Three.js + Vite) | `5174` |
| SIRH (sistema externo — pendiente) | `3000` |
| Prisma Studio | `5555` |

---

## ARCHIVOS DE PROMPT

| Agente | Archivo |
|--------|---------|
| Modelado 3D | `PROMPT_AGENTE_MODELADO3D.md` |
| Frontend | `PROMPT_AGENTE_FRONTEND.md` |
| Backend Senior | `PROMPT_AGENTE_BACKEND.md` |
| Base de Datos | `PROMPT_AGENTE_DATABASE.md` |

---

## ROLES DE USUARIO EN SIAST

| Rol | Descripción | Capacidades clave |
|-----|-------------|-------------------|
| `ADMIN` | Administrador del sistema | Todo: ver, asignar, cerrar, gestionar usuarios |
| `TECNICO_INFORMATICO` | Técnico de sistemas/TI | Ver y atender tickets tecnológicos asignados |
| `TECNICO_SERVICIOS` | Técnico de servicios generales | Ver y atender tickets de servicios asignados |
| `MESA_AYUDA` | **Operador de Mesa de Ayuda** | Crear/eliminar tickets en nombre de empleados que no puedan hacerlo |
| `EMPLEADO` | Empleado de la Secretaría | Crear hasta 2 tickets activos (login solo con RFC) |

---

## CATÁLOGO DE TICKETS

```
Tecnologías
  ├── Sistemas
  ├── Soporte Técnico
  ├── Redes
  ├── Internet
  └── Impresoras u Otros

Servicios
  ├── Sanitarios
  ├── Iluminación
  └── Movilidad
```

---

## FLUJO DE CREACIÓN DE TICKET

```
1. Empleado llega a /login
2. Ingresa su RFC (validado contra SIRH / BD local)
3. Sistema identifica su área y piso en el edificio
4. Se muestra formulario + mapa 3D con su ubicación resaltada
5. Llena el formulario de ticket
6. Se verifica límite: máximo 2 tickets activos por empleado
7. Al crear: Admin recibe notificación en tiempo real (Socket.IO)
8. Admin asigna ticket a técnico → Técnico y empleado reciben notificación
9. Técnico atiende → actualiza estado → empleado recibe notificaciones
```

---

## URL CON MAPA 3D

Cuando un ticket se asigna, el empleado recibe un enlace:
```
https://siast.finanzas.oaxaca.gob.mx/tickets/123?rfc=PELJ850312HDF
```
Esta pantalla muestra:
- Panel izquierdo: información del ticket + estado + técnico asignado
- Panel derecho: mapa 3D del edificio con el cuarto del empleado resaltado + su información

---

## PLANOS ARQUITECTÓNICOS PROCESADOS

Los 4 planos del edificio Saúl Martínez están en el proyecto Claude como archivos adjuntos.
Cada plano es un ZIP con:
- `1.jpeg` — plano en imagen (cuadrícula 32×27)
- `manifest.json` — metadatos

| Archivo | Nivel | Floor |
|---------|-------|-------|
| `pb.pdf` | Planta Baja | 0 |
| `nivel1.pdf` | Nivel 1 | 1 |
| `nivel2.pdf` | Nivel 2 | 2 |
| `nivel3.pdf` | Nivel 3 | 3 |

**Áreas identificadas en los planos:**
- **PB:** Acceso Principal, Área de Archivos, Ingresos, Unidad Administrativa, Control/Caja
- **N1:** Secretaría de Finanzas, Subsecretarías, Jurídico, Salón Morelos, Centro de Reuniones
- **N2:** Informática, Recaudación, Contraloría, Egresos, Dirección de Egresos, Nóminas
- **N3:** (extraer del plano nivel3.pdf)

---

## INTEGRACIÓN SIRH (PENDIENTE)

El SIRH está en `localhost:3000/getPlantilla` y retorna la plantilla de empleados.
**Estado:** Pendiente — todos los sistemas están preparados para recibirla.

Para activarla cuando esté lista:
1. Cambiar en `.env` del backend: `SIRH_ENABLED=true`
2. Implementar `SirhService.getPlantilla()` en el backend
3. El resto del sistema ya está preparado

---

## NOMBRE DEL ROL MESA DE AYUDA

Sugerencia: **"Operador de Mesa de Ayuda"** o simplemente **"Mesa de Ayuda"**.
- Son los agentes que pueden crear y eliminar tickets en nombre de empleados
- Tienen acceso al sistema con usuario/contraseña (no con RFC)
- Útiles cuando el empleado no tiene acceso a computadora o red
