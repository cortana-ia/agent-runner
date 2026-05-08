import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker as BullWorker } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';

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

  private get AnthropicApiKey(): string {
    return this.config.get('ANTHROPIC_API_KEY') || process.env.ANTHROPIC_API_KEY || '';
  }

  private get ClaudePath(): string {
    return this.config.get('CLAUDE_PATH') || process.env.CLAUDE_PATH || '/data/.local/bin/claude';
  }

  async onModuleDestroy() {
    await this.worker?.close();
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
        this.config.get('PROJECTS_PATH') || '/data/workspace',
        task.project,
      );

      if (!fs.existsSync(projectPath)) {
        throw new Error(`Proyecto no encontrado: ${projectPath}`);
      }

      addLog(`Proyecto: ${projectPath}`);

      // Git checkout main y pull
      await this.runCommand('git checkout main', projectPath, addLog);
      await this.runCommand('git pull origin main', projectPath, addLog);

      // Crear rama
      await this.runCommand(`git checkout -B ${task.branch}`, projectPath, addLog);

      addLog('2. Ejecutando Anthropic API...');

      // 2. Ejecutar Claude con el prompt
      const fullPrompt = this.buildPrompt(task.project, task.module, task.prompt, projectPath);
      
      // Intentar usar Anthropic API, si no hay key usar CLI
      if (this.AnthropicApiKey) {
        const result = await this.callAnthropicAPI(fullPrompt, addLog);
        addLog(`Resultado: ${result}`);
      } else {
        // Fallback a CLI de Claude Code
        await this.runClaudeCLI(fullPrompt, projectPath, addLog);
      }

      // 3. Ejecutar lint y build
      addLog('3. Ejecutando validaciones...');
      
      try {
        await this.runCommand('pnpm run lint || true', projectPath, addLog);
      } catch (e) {
        addLog(`Lint: ${(e as Error).message}`);
      }
      
      try {
        await this.runCommand('pnpm run build || true', projectPath, addLog);
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

  private buildPrompt(project: string, module: string, description: string, projectPath: string): string {
    // Leer README si existe
    let readmeContent = '';
    const readmePath = path.join(projectPath, 'README.md');
    if (fs.existsSync(readmePath)) {
      readmeContent = fs.readFileSync(readmePath, 'utf-8').substring(0, 2000);
    }

    return `
Eres un desarrollador senior full-stack con experiencia en proyectos médicos.

Proyecto: ${project}

${readmeContent ? `README del proyecto:\n${readmeContent}` : ''}

Módulo a implementar: ${module}

Tarea: ${description}

Instrucciones:
1. Lee la documentación del proyecto
2. Implementa el módulo siguiendo la arquitectura existente  
3. No modifiques archivos no relacionados
4. Ejecuta pnpm run lint y pnpm run build
5. Al terminar, reporta los cambios realizados

Restricciones:
- No modificar archivos .env
- No usar credenciales de producción
- No aplicar migraciones en producción
- No hacer merge a main
`;
  }

  private async callAnthropicAPI(prompt: string, addLog: (msg: string) => void): Promise<string> {
    const apiKey = this.AnthropicApiKey;
    
    try {
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          messages: [
            { role: 'user', content: prompt }
          ]
        },
        {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.content[0].text;
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || error.message;
      addLog(`API Error: ${msg}`);
      throw new Error(`Anthropic API error: ${msg}`);
    }
  }

  private async runClaudeCLI(
    prompt: string,
    cwd: string,
    addLog: (msg: string) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const promptFile = path.join(cwd, '.claude-prompt.txt');
      fs.writeFileSync(promptFile, prompt);

      const claudePath = this.ClaudePath;

      const proc = spawn(
        claudePath,
        ['--print', promptFile],
        {
          cwd,
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, CLAUDE_AS_HEADLESS: 'true' },
        },
      );

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
            addLog(`Command: ${command} - ${error.message}`);
            resolve(stderr || error.message);
            return;
          }
          addLog(`Output: ${stdout.substring(0, 500)}`);
          resolve(stdout);
        },
      );
    });
  }
}

// Necesario para el import de spawn
import { spawn } from 'child_process';