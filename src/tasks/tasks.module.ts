import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkerModule } from '../worker/worker.module';

@Module({
  imports: [ConfigModule.forRoot(), PrismaModule, WorkerModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}