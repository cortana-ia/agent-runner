import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkerService } from '../worker/worker.service';
import { CreateTaskDto } from '../dto/create-task.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly worker: WorkerService,
  ) {}

  async createTask(createTaskDto: CreateTaskDto) {
    const task = await this.prisma.task.create({
      data: {
        project: createTaskDto.project,
        module: createTaskDto.module,
        branch: createTaskDto.branch,
        prompt: createTaskDto.description,
        status: 'PENDING',
      },
    });

    // Encolar tarea para el worker
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

  async getTask(id: number) {
    return this.prisma.task.findUnique({
      where: { id },
    });
  }
}