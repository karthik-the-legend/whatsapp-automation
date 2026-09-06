-- Rename the default branch value for new Batch rows from the old
-- placeholder "Branch 1" to the real, verified branch name "Main Branch".
-- Existing rows are unaffected (they're renamed via a reseed - see
-- prisma/seed.ts - since seeded batches are matched by (name, branch)).
ALTER TABLE "Batch" ALTER COLUMN "branch" SET DEFAULT 'Main Branch';
