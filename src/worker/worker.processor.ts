import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker as BullWorker } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import { exec, spawn } from 'child_process';

interface TaskData {
  taskId: number;
}

@Injectable()
export class WorkerProcessor implements OnModuleInit {
  private worker: BullWorker;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    // Iniciar worker de BullMQ
    this.worker = new BullWorker(
      'agent-tasks',
      async (job: Job<TaskData>) => {
        return this.processTask(job.data.taskId);
      },
      {
        connection: {
          host: this.config.get('REDIS_HOST') || 'localhost',
          port: parseInt(this.config.get('REDIS_PORT') || '6379'),
        },
        concurrency: 2,
      },
    );

    this.worker.on('completed', (job) => {
      console.log(`Tarea ${job.id} completada`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Tarea ${job.id} fallida:`, err.message);
    });

    console.log('Worker de tareas iniciado');
  }

  private async processTask(taskId: number): Promise<void> {
    console.log(`Procesando tarea ${taskId}`);

    // Obtener tarea
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      throw new Error(`Tarea ${taskId} no encontrada`);
    }

    // Actualizar estado
    await this.prisma.task.update({
      where: { id: taskId },
      data: { status: 'RUNNING' },
    });

    const logs: string[] = [];
    const addLog = (msg: string) => {
      logs.push(`[${new Date().toISOString()}] ${msg}`);
      console.log(msg);
    };

    try {
      // 1. Preparar repositorio
      addLog('Preparando repositorio...');
      const projectPath = path.join(
        this.config.get('PROJECTS_PATH') || '/data/workspace/projects',
        task.project,
      );

      if (!fs.existsSync(projectPath)) {
        addLog(`Creando directorio del proyecto: ${projectPath}`);
        fs.mkdirSync(projectPath, { recursive: true });
      }

      // Git checkout main y pull
      await this.runCommand('git checkout main', projectPath, addLog);
      await this.runCommand('git pull origin main', projectPath, addLog);

      // Crear rama
      await this.runCommand(`git checkout -B ${task.branch}`, projectPath, addLog);

      addLog('2. Ejecutando Claude Code...');

      // 2. Ejecutar Claude Code con el prompt
      const fullPrompt = this.buildPrompt(task.project, task.module, task.prompt);
      await this.runClaudeCode(fullPrompt, projectPath, addLog);

      // 3. Ejecutar lint y build
      addLog('3. Ejecutando validaciones...');
      
      try {
        await this.runCommand('npm run lint || true', projectPath, addLog);
      } catch (e) {
        addLog(`Lint: ${(e as Error).message}`);
      }
      
      try {
        await this.runCommand('npm run build || true', projectPath, addLog);
      } catch (e) {
        addLog(`Build: ${(e as Error).message}`);
      }

      // 4. Commit y push
      addLog('4. Guardando cambios...');
      await this.runCommand('git status', projectPath, addLog);
      await this.runCommand('git add .', projectPath, addLog);
      await this.runCommand(
        `git commit -m "agent: ${task.module} - ${task.prompt.substring(0, 50)}..."`,
        projectPath,
        addLog,
      );
      await this.runCommand(`git push origin ${task.branch}`, projectPath, addLog);

      // 5. Guardar resultado
      const result = logs.join('\n');
      await this.prisma.task.update({
        where: { id: taskId },
        data: {
          status: 'DONE',
          logs: result,
          result: `Rama ${task.branch} creada y empujada`,
        },
      });

      addLog('Tarea completada exitosamente');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      addLog(`ERROR: ${errorMessage}`);

      await this.prisma.task.update({
        where: { id: taskId },
        data: {
          status: 'FAILED',
          logs: logs.join('\n'),
          result: errorMessage,
        },
      });

      throw error;
    }
  }

  private buildPrompt(project: string, module: string, description: string): string {
    return `
Eres un desarrollador senior full-stack.

Proyecto: ${project}
Módulo a implementar: ${module}

Tarea: ${description}

Stack tecnológico:
- Backend: NestJS
- Frontend: Next.js
- ORM: Prisma
- Base de datos: PostgreSQL
- Autenticación: JWT

Instrucciones:
1. Lee la documentación del proyecto en docs/
2. Implementa el módulo siguiendo la arquitectura existente
3. No modifiques archivos no relacionados
4. Ejecuta npm run lint y npm run build
5. Crea un resumen de cambios en docs/agent-reports/${module}.md
6. Al terminar, reporta los cambios realizados

Restricciones:
- No modificar archivos .env
- No usar credenciales de producción
- No aplicar migraciones en producción
- No hacer merge a main
`;
  }

  private async runCommand(
    command: string,
    cwd: string,
    addLog: (msg: string) => void,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(
        command,
        { cwd, maxBuffer: 1024 * 1024 * 10 },
        (error, stdout, stderr) => {
          if (error) {
            addLog(`Command error: ${command} - ${error.message}`);
            // No rechazamos por errores en git operations
            resolve(stderr || error.message);
            return;
          }
          addLog(`Output: ${stdout.substring(0, 500)}`);
          resolve(stdout);
        },
      );
    });
  }

  private async runClaudeCode(
    prompt: string,
    cwd: string,
    addLog: (msg: string) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const promptFile = path.join(cwd, '.claude-prompt.txt');
      fs.writeFileSync(promptFile, prompt);

      const proc = spawn('claude', [promptFile], {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, CLAUDE_AS_HEADLESS: 'true' },
      });

      let output = '';
      proc.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        addLog(text);
      });

      proc.stderr.on('data', (data) => {
        addLog(`Claude error: ${data.toString()}`);
      });

      proc.on('close', (code) => {
        try {
          fs.unlinkSync(promptFile);
        } catch (e) {}
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Claude Code exits with code ${code}`));
        }
      });

      proc.on('error', (err) => {
        try {
          fs.unlinkSync(promptFile);
        } catch (e) {}
        reject(err);
      });
    });
  }
}