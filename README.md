# RETIMAX System

Sistema de gestión del ciclo de vida de maquinaria industrial para RETIMAX (Recmotors).

Monorepo Turborepo con:
- **API** (`apps/api`): NestJS + Prisma + PostgreSQL
- **Web** (`apps/web`): Next.js 15 + React 19 + TailwindCSS
- **Tipos compartidos** (`packages/shared-types`)

## Requisitos

- Node.js 20+
- pnpm 10+
- PostgreSQL 15+ (local o Docker)

## Inicio rápido — desarrollo local

```bash
pnpm install
cp .env.example .env
# Ajustar DATABASE_URL si es necesario

pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

Levantar **dos terminales**:

```bash
# Terminal 1 — API (puerto 4000)
pnpm dev:api

# Terminal 2 — Web (puerto 3000)
pnpm dev:web
```

Si la web falla con errores de caché (`Cannot find module './xxx.js'` o `reading 'call'`):

```bash
pnpm dev:web:clean
```

**No es problema de RAM.** Ocurre cuando se mezcla `pnpm build` con `pnpm dev:web` al mismo tiempo. Regla: nunca correr build mientras dev está activo.

Guía completa de deploy: [docs/RAILWAY.md](docs/RAILWAY.md)

**Importante:** usar siempre `http://localhost:3000` (no la IP de red) para evitar problemas de CORS.

### Credenciales demo (solo desarrollo local)

| Rol | Usuario | Contraseña |
|-----|---------|------------|
| Admin | `admin` | `Admin123!` |
| Empleado | `alex` | `Empleado123!` |

### Producción Contabo

Usuario y contraseña del admin de prod están en **[docs/CREDENCIALES-LOCAL.md](docs/CREDENCIALES-LOCAL.md)** (archivo **gitignored**, solo en tu PC; no se sube a GitHub). Operación del VPS: [docs/CONTABO-PROD.md](docs/CONTABO-PROD.md).

## Inicio rápido — Docker

```bash
cp .env.example .env
docker compose up -d --build
```

- Frontend: http://localhost:3000
- API: http://localhost:4000
- PostgreSQL: localhost:5432

## Módulos

| Módulo | Descripción |
|--------|-------------|
| Dashboard | Resumen por estado del pipeline |
| Máquinas | Registro, fotos, pipeline, mantenimiento, precios |
| Empleados | Registro con email sugerido y acceso al portal |
| Mis trabajos | Portal del empleado (asignación, inicio, fin) |
| Pedidos | Reservas con anticipo y recibo |
| Ventas | Solo máquinas lista/reservada, recibo imprimible |
| Clientes | Nombre, NIT/CI, teléfono |
| Proveedores | Catálogo de proveedores |
| Reportería | Inventario, ventas, trabajos — imprimible |

## Estructura

```
apps/
  api/          # Backend REST + JWT
  web/          # Frontend App Router
packages/
  shared-types/ # Enums y DTOs compartidos
scripts/
  backup.sh     # Backup cifrado de DB + fotos (Docker)
```

## Seguridad

- JWT access (15 min) + refresh con rotación
- Rate limiting en `/auth/login`
- Helmet + CORS restringido
- Uploads: whitelist mimetype, máx 8 MB, WebP + miniatura
- Contraseñas empleados: mínimo 8 chars, mayús, minús, número y símbolo

## Deploy demo — recomendaciones

Para una demo rápida, el orden recomendado es:

1. **Railway** (recomendado para demo)
   - Despliega API + PostgreSQL + Web en un solo proyecto
   - Variables de entorno sencillas, HTTPS automático
   - Plan gratuito limitado pero suficiente para demo

2. **Render**
   - Similar a Railway, buena opción gratuita
   - PostgreSQL managed incluido
   - El servicio free puede "dormir" tras inactividad (~50 s al despertar)

3. **Fly.io**
   - Más control, ideal si quieres región cercana (ej. São Paulo)
   - Requiere más configuración (Dockerfile, `fly.toml`, volúmenes para uploads)

**Sugerencia práctica:** usa **Railway** para la demo inicial. Si necesitas que no duerma, Render con plan pago o Fly.io con máquina siempre activa.

Variables mínimas en producción:

```
DATABASE_URL=postgresql://...
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
CORS_ORIGIN=https://tu-dominio-web.com
NEXT_PUBLIC_API_URL=https://tu-dominio-api.com
UPLOAD_DIR=./uploads
```

## Scripts útiles

```bash
pnpm dev              # API + Web en paralelo
pnpm dev:api          # Solo API
pnpm dev:web          # Solo Web
pnpm dev:web:clean    # Limpia .next y reinicia Web
pnpm build            # Build producción
pnpm db:migrate       # Aplicar migraciones
pnpm db:seed          # Datos demo
```

## Rama principal

Desarrollo activo en: **`main`**
