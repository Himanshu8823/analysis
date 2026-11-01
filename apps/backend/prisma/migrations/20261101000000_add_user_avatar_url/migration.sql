-- ============================================================================
-- Add the member's profile picture to the `users` table.
--
-- The column is nullable: a member who never picks a picture has no row here,
-- and the UI falls back to their initials.
--
-- The value is a URL into the object-storage bucket (Neon Storage), not the
-- image bytes — the bytes live in the bucket, the database only remembers
-- where they were written.
-- ============================================================================

-- AlterTable
ALTER TABLE "users" ADD COLUMN "avatar_url" TEXT;
