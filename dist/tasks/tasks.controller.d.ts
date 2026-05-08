import { TasksService } from './tasks.service';
import { CreateTaskDto } from '../dto/create-task.dto';
export declare class TasksController {
    private readonly tasksService;
    constructor(tasksService: TasksService);
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
    getTask(id: string): Promise<{
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
