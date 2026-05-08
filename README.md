# Agent Runner

Agente orquestador para ejecución de tareas con Claude Code. Este proyecto permite recibir solicitudes de desarrollo, encolarlas y ejecutarlas automáticamente sobre repositorios Git.

## Arquitectura

```
Usuario / OpenClaw
        ↓
Agent Runner API (NestJS)
        ↓
PostgreSQL (tareas)
        ↓
Redis (cola BullMQ)
        ↓
Worker (Claude Code)
        ↓
GitHub (rama + commit + push)
        ↓
Revisión humana
```

## Uso

### Iniciar servicios

```bash
docker-compose up -d
```

### Crear tarea

```bash
curl -X POST http://localhost:3000/api/agent/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secret-token" \
  -d '{
    "project": "mi-proyecto",
    "module": "usuarios",
    "description": "Crear módulo de usuarios con CRUD",
    "branch": "feature/modulo-usuarios"
  }'
```

### Ver tareas

```bash
curl http://localhost:3000/api/agent/tasks
```

## Configuración

Variables de entorno en `.env`:

```
DATABASE_URL=postgresql://agent:agent_password@localhost:5432/agent_factory
REDIS_HOST=localhost
REDIS_PORT=6379
PROJECTS_PATH=/data/workspace/projects
AGENT_TOKEN=your-secret-token
PORT=3000
```

## Estados de Tarea

- `PENDING` - Pendiente de procesar
- `RUNNING` - Ejecutando tarea
- `DONE` - Completada exitosamente
- `FAILED` - Fallida

## Worker

El worker:
1. Toma tarea pendiente
2. Prepara repositorio (git checkout main, git pull, git checkout -b rama)
3. Ejecuta Claude Code con el prompt
4. Ejecuta lint y build
5. Crea commit y push
6. Guarda resultado en la base de datos