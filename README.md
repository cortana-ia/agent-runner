# Agent Runner

Agente orquestador para ejecución de tareas con Claude Code. Este proyecto permite recibir solicitudes de desarrollo, encolarlas y ejecutarlas automáticamente sobre repositorios Git.

## Arquitectura

```
Usuario / OpenClaw / API
        ↓
Agent Runner API (NestJS) - Puerto 3001
        ↓
PostgreSQL (puerto 5432)
        ↓
Redis/BullMQ (puerto 6379)
        ↓
Worker (Claude Code o Anthropic API)
        ↓
GitHub (rama + commit + push)
        ↓
Revisión humana
```

## Uso Local

### Requisitos

- Node.js 22+
- PostgreSQL 15+
- Redis 7+

### Instalación

```bash
# Instalar dependencias
pnpm install

# Generar Prisma Client
pnpm exec prisma generate

# Crear base de datos
su - postgres -c "psql -c \"CREATE USER agent WITH PASSWORD 'agent_password';\""
su - postgres -c "psql -c \"CREATE DATABASE agent_factory OWNER agent;\""
su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE agent_factory TO agent;\""
su - postgres -c "psql -c \"ALTER USER agent CREATEDB;\""

# Migrar schema
pnpm exec prisma migrate dev --name init
```

### Configuración

```bash
cp .env.example .env
# Editar .env con valores locales
```

### Iniciar

```bash
pnpm start
# API disponible en http://localhost:3001
```

## Uso con Docker

```bash
docker-compose up -d
```

## API Endpoints

### Crear tarea

```bash
curl -X POST http://localhost:3001/api/agent/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "project": "biai-salud-frontend",
    "module": "usuarios",
    "description": "Crear módulo de usuarios",
    "branch": "feature/modulo-usuarios"
  }'
```

### Ver todas las tareas

```bash
curl http://localhost:3001/api/agent/tasks
```

### Ver tarea específica

```bash
curl http://localhost:3001/api/agent/tasks/1
```

## Variables de Entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| DATABASE_URL | URL de PostgreSQL | postgresql://agent:password@localhost:5432/agent_factory |
| REDIS_HOST | Host de Redis | localhost |
| REDIS_PORT | Puerto de Redis | 6379 |
| PROJECTS_PATH | Path de proyectos | /data/workspace |
| ANTHROPIC_API_KEY | API key de Anthropic | (vacío) |
| CLAUDE_PATH | Path de Claude Code CLI | /data/.local/bin/claude |
| PORT | Puerto de API | 3001 |

## Estados de Tarea

- `PENDING` - Pendiente de procesar
- `RUNNING` - Ejecutando tarea
- `DONE` - Completada exitosamente
- `FAILED` - Fallida

## Worker

El worker:
1. Toma tarea pendiente
2. Prepara repositorio (git checkout main, git pull, git checkout -b rama)
3. Ejecuta Claude (CLI o API de Anthropic)
4. Ejecuta lint y build
5. Crea commit y push
6. Guarda resultado en la base de datos

## Para VPS

Cambiar `.env`:
```
REDIS_HOST=redis
# PostgreSQL via docker o servicio del VPS
```

Subir a GitHub:
```bash
git add -A
git commit -m "feat: agent runner completo"
git push origin main
```