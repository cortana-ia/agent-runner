import { PrismaService } from '../prisma/prisma.service';
import { WorkerService } from '../worker/worker.service';
import { CreateTaskDto } from '../dto/create-task.dto';
export declare class TasksService {
    private readonly prisma;
    private readonly worker;
    constructor(prisma: PrismaService, worker: WorkerService);
    createTask(createTaskDto: CreateTaskDto): Promise<{
        message: string;
        taskId: number;
        status: string;
    }>;
    getAllTasks(): Promise<{
        id: number;
        status: string;
        module: string;
        project: string;
        branch: string;
        prompt: string;
        logs: string | null;
        result: string | null;
        created_at: Date;
        updated_at: Date;
    }[]>;
    getTask(id: number): Promise<{
        id: number;
        status: string;
        module: string;
        project: string;
        branch: string;
        prompt: string;
        logs: string | null;
        result: string | null;
        created_at: Date;
        updated_at: Date;
    }>;
}
