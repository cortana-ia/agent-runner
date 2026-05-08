import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WorkerService } from './worker.service';
import { WorkerProcessor } from './worker.processor';

@Module({
  imports: [ConfigModule.forRoot()],
  providers: [WorkerService, WorkerProcessor],
  exports: [WorkerService],
})
export class WorkerModule {}