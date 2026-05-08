import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
export declare class WorkerService implements OnModuleInit {
    private readonly config;
    private readonly prisma;
    private taskQueue;
    constructor(config: ConfigService, prisma: PrismaService);
    onModuleInit(): Promise<void>;
    enqueueTask(taskId: number): Promise<void>;
}
