"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerProcessor = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const bullmq_1 = require("bullmq");
const prisma_service_1 = require("../prisma/prisma.service");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
let WorkerProcessor = class WorkerProcessor {
    constructor(config, prisma) {
        this.config = config;
        this.prisma = prisma;
    }
    async onModuleInit() {
        this.worker = new bullmq_1.Worker('agent-tasks', async (job) => {
            return this.processTask(job.data.taskId);
        }, {
            connection: {
                host: this.config.get('REDIS_HOST') || 'localhost',
                port: parseInt(this.config.get('REDIS_PORT') || '6379'),
            },
            concurrency: 2,
        });
        this.worker.on('completed', (job) => {
            console.log(`Tarea ${job.id} completada`);
        });
        this.worker.on('failed', (job, err) => {
            console.error(`Tarea ${job.id} fallida:`, err.message);
        });
        console.log('Worker de tareas iniciado');
    }
    async processTask(taskId) {
        console.log(`Procesando tarea ${taskId}`);
        const task = await this.prisma.task.findUnique({ where: { id: taskId } });
        if (!task) {
            throw new Error(`Tarea ${taskId} no encontrada`);
        }
        await this.prisma.task.update({
            where: { id: taskId },
            data: { status: 'RUNNING' },
        });
        const logs = [];
        const addLog = (msg) => {
            logs.push(`[${new Date().toISOString()}] ${msg}`);
            console.log(msg);
        };
        try {
            addLog('Preparando repositorio...');
            const projectPath = path.join(this.config.get('PROJECTS_PATH') || '/data/workspace/projects', task.project);
            if (!fs.existsSync(projectPath)) {
                addLog(`Creando directorio del proyecto: ${projectPath}`);
                fs.mkdirSync(projectPath, { recursive: true });
            }
            await this.runCommand('git checkout main', projectPath, addLog);
            await this.runCommand('git pull origin main', projectPath, addLog);
            await this.runCommand(`git checkout -B ${task.branch}`, projectPath, addLog);
            addLog('2. Ejecutando Claude Code...');
            const fullPrompt = this.buildPrompt(task.project, task.module, task.prompt);
            await this.runClaudeCode(fullPrompt, projectPath, addLog);
            addLog('3. Ejecutando validaciones...');
            try {
                await this.runCommand('npm run lint || true', projectPath, addLog);
            }
            catch (e) {
                addLog(`Lint: ${e.message}`);
            }
            try {
                await this.runCommand('npm run build || true', projectPath, addLog);
            }
            catch (e) {
                addLog(`Build: ${e.message}`);
            }
            addLog('4. Guardando cambios...');
            await this.runCommand('git status', projectPath, addLog);
            await this.runCommand('git add .', projectPath, addLog);
            await this.runCommand(`git commit -m "agent: ${task.module} - ${task.prompt.substring(0, 50)}..."`, projectPath, addLog);
            await this.runCommand(`git push origin ${task.branch}`, projectPath, addLog);
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
        }
        catch (error) {
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
    buildPrompt(project, module, description) {
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
    async runCommand(command, cwd, addLog) {
        return new Promise((resolve, reject) => {
            (0, child_process_1.exec)(command, { cwd, maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
                if (error) {
                    addLog(`Command error: ${command} - ${error.message}`);
                    resolve(stderr || error.message);
                    return;
                }
                addLog(`Output: ${stdout.substring(0, 500)}`);
                resolve(stdout);
            });
        });
    }
    async runClaudeCode(prompt, cwd, addLog) {
        return new Promise((resolve, reject) => {
            const promptFile = path.join(cwd, '.claude-prompt.txt');
            fs.writeFileSync(promptFile, prompt);
            const proc = (0, child_process_1.spawn)('claude', [promptFile], {
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
                }
                catch (e) { }
                if (code === 0) {
                    resolve();
                }
                else {
                    reject(new Error(`Claude Code exits with code ${code}`));
                }
            });
            proc.on('error', (err) => {
                try {
                    fs.unlinkSync(promptFile);
                }
                catch (e) { }
                reject(err);
            });
        });
    }
};
exports.WorkerProcessor = WorkerProcessor;
exports.WorkerProcessor = WorkerProcessor = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService])
], WorkerProcessor);
//# sourceMappingURL=worker.processor.js.map