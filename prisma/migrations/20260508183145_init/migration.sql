-- CreateTable
CREATE TABLE "agent_tasks" (
    "id" SERIAL NOT NULL,
    "project" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "logs" TEXT,
    "result" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_tasks_pkey" PRIMARY KEY ("id")
);
