import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
export declare class WorkerProcessor implements OnModuleInit {
    private readonly config;
    private readonly prisma;
    private worker;
    constructor(config: ConfigService, prisma: PrismaService);
    onModuleInit(): Promise<void>;
    private get AnthropicApiKey();
    private get ClaudePath();
    onModuleDestroy(): Promise<void>;
    private processTask;
    private buildPrompt;
    private callAnthropicAPI;
    private runClaudeCLI;
    private runCommand;
}
