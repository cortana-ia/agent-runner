import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WorkerService implements OnModuleInit {
  private taskQueue: Queue;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    // Inicializar cola de BullMQ
    this.taskQueue = new Queue('agent-tasks', {
      connection: {
        host: this.config.get('REDIS_HOST') || 'localhost',
        port: parseInt(this.config.get('REDIS_PORT') || '6379'),
      },
    });
  }

  async enqueueTask(taskId: number) {
    await this.taskQueue.add('process-task', { taskId });
  }
}