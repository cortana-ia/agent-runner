import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from '../dto/create-task.dto';

@Controller('agent')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post('tasks')
  async createTask(@Body() createTaskDto: CreateTaskDto) {
    return this.tasksService.createTask(createTaskDto);
  }

  @Get('tasks')
  async getAllTasks() {
    return this.tasksService.getAllTasks();
  }

  @Get('tasks/:id')
  async getTask(@Param('id') id: string) {
    return this.tasksService.getTask(+id);
  }
}