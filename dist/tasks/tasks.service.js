"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TasksService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const worker_service_1 = require("../worker/worker.service");
let TasksService = class TasksService {
    constructor(prisma, worker) {
        this.prisma = prisma;
        this.worker = worker;
    }
    async createTask(createTaskDto) {
        const task = await this.prisma.task.create({
            data: {
                project: createTaskDto.project,
                module: createTaskDto.module,
                branch: createTaskDto.branch,
                prompt: createTaskDto.description,
                status: 'PENDING',
            },
        });
        await this.worker.enqueueTask(task.id);
        return {
            message: 'Tarea recibida correctamente',
            taskId: task.id,
            status: task.status,
        };
    }
    async getAllTasks() {
        return this.prisma.task.findMany({
            orderBy: { created_at: 'desc' },
        });
    }
    async getTask(id) {
        return this.prisma.task.findUnique({
            where: { id },
        });
    }
};
exports.TasksService = TasksService;
exports.TasksService = TasksService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        worker_service_1.WorkerService])
], TasksService);
//# sourceMappingURL=tasks.service.js.map