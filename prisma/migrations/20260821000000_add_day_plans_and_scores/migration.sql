-- AlterTable
ALTER TABLE "routines" ADD COLUMN "dayPlans" JSONB;

-- AlterTable
ALTER TABLE "weeks" ADD COLUMN "scores" JSONB NOT NULL DEFAULT '{}';