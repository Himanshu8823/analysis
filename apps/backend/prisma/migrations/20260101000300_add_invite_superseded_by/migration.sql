-- AlterTable
ALTER TABLE "invites" ADD COLUMN     "superseded_by_id" TEXT;

-- CreateIndex
CREATE INDEX "invites_superseded_by_id_idx" ON "invites"("superseded_by_id");

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_superseded_by_id_fkey" FOREIGN KEY ("superseded_by_id") REFERENCES "invites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
