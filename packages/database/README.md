# @stf/database — SIAST Base de Datos

Paquete Prisma + MySQL para el Sistema Integral de Atención y Soporte Técnico (SIAST).

## Requisitos

- MySQL 8.0+ / MariaDB 10.4+ (XAMPP incluido)
- Node.js 18+

## Setup inicial

### 1. Crear base de datos y usuario

Con XAMPP corriendo, ejecutar como root:

```bash
# Desde la raíz del monorepo
cd packages/database
/c/xampp/mysql/bin/mysql -u root < scripts/setup.sql
```

O desde MySQL Workbench / phpMyAdmin, correr el contenido de `scripts/setup.sql`.

### 2. Instalar dependencias

```bash
# Desde la raíz del monorepo
npm install
```

### 3. Correr migración inicial

```bash
cd packages/database
npx prisma migrate dev --name init_siast
```

### 4. Generar Prisma Client

```bash
npx prisma generate
```

### 5. Cargar datos iniciales

```bash
npx tsx prisma/seed.ts
```

### 6. Verificar datos (opcional)

```bash
npx prisma studio
# Abre http://localhost:5555
```

## Comandos disponibles

```bash
npm run db:migrate   # npx prisma migrate dev
npm run db:generate  # npx prisma generate
npm run db:seed      # tsx prisma/seed.ts
npm run db:studio    # npx prisma studio (puerto 5555)
npm run db:reset     # npx prisma migrate reset (¡borra todos los datos!)
```

## Variables de entorno

Archivo `.env` en esta carpeta:

```env
DATABASE_URL="mysql://siast_user:siast_pass@localhost:3306/siast_db"
```

## Uso desde otros paquetes

```typescript
import { prisma } from "@stf/database";

const tickets = await prisma.ticket.findMany({
  where: { activo: true, estado: "ABIERTO" },
});
```

## Estructura

```
packages/database/
├── prisma/
│   ├── schema.prisma       ← schema principal
│   ├── seed.ts             ← datos iniciales
│   └── migrations/         ← generadas por Prisma (no editar manualmente)
├── scripts/
│   └── setup.sql           ← crea BD y usuario MySQL
├── src/
│   └── index.ts            ← exporta instancia PrismaClient
├── docs/
│   └── ERD.md              ← diagrama entidad-relación
├── .env                    ← DATABASE_URL
└── tsconfig.json
```

## Documentación

Ver `docs/ERD.md` para el diagrama entidad-relación completo.
