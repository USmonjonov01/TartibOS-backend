-- AlterTable
ALTER TABLE "daily_reviews"
  ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'daily',
  ADD COLUMN "weekId" TEXT,
  ADD COLUMN "achievement" TEXT,
  ADD COLUMN "nextFocus" TEXT,
  ADD COLUMN "reflection" TEXT,
  ADD COLUMN "discipline" INTEGER,
  ADD COLUMN "execution" INTEGER,
  ADD COLUMN "missionRate" INTEGER,
  ADD COLUMN "habitConsistency" INTEGER,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "daily_reviews" DROP COLUMN "win";
ALTER TABLE "daily_reviews" DROP COLUMN "tomorrow";

-- CreateIndex
CREATE INDEX "daily_reviews_userId_mode_date_idx" ON "daily_reviews"("userId", "mode", "date");

-- CreateIndex
CREATE INDEX "daily_reviews_userId_mode_weekId_idx" ON "daily_reviews"("userId", "mode", "weekId");
