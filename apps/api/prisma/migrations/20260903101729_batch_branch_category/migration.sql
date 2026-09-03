-- CreateEnum
CREATE TYPE "BatchCategory" AS ENUM ('KUNG_FU', 'SENIOR', 'DANCE');

-- AlterTable
ALTER TABLE "Batch"
  ADD COLUMN "branch" TEXT NOT NULL DEFAULT 'Branch 1',
  ADD COLUMN "category" "BatchCategory" NOT NULL DEFAULT 'KUNG_FU',
  ADD COLUMN "audience" TEXT,
  ALTER COLUMN "feeAmount" DROP NOT NULL;
