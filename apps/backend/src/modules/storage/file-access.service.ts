import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { StorageService } from './storage.service';
import { AuthorisationService } from '@/common/services/authorisation.service';

/**
 * Who may read a stored file.
 *
 * The `/files` route serves the bytes of everything the system stores: result
 * statements uploaded for parsing, and members' profile pictures. Both are
 * personal to somebody — a result statement is a page of marks, and an
 * avatar belongs to one member — so the route cannot simply be "any signed-in
 * member".
 *
 * The rules, in order:
 *
 *  1. **The exam cell** (`upload:process`) may read every upload. It
 *     administers the whole exam, and confirming an extraction means
 *     reading the file it came from.
 *  2. **The uploader** may read the file they uploaded — it is their own
 *     upload and their own history.
 *  3. **A member** may read their own profile picture.
 *  4. **Nobody else** may read it. A member with `users:read` may read a
 *     colleague's *name*; they may not download their colleague's result
 *     statement.
 *
 * A file that cannot be attributed to an upload or an avatar — one written
 * by some other part of the system — is readable only by the exam cell.
 */
@Injectable()
export class FileAccessService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: StorageService,
    private readonly authorisation: AuthorisationService
  ) {}

  /**
   * Whether the member may read the file at the given storage-relative path.
   *
   * The path is matched against the recorded upload URLs and avatar URLs
   * rather than against a naming convention, so a file cannot be read by
   * guessing its name.
   */
  async mayRead(relativePath: string, memberId: string): Promise<boolean> {
    const permissions = await this.authorisation.permissionsOf(memberId);
    const isExamCell = permissions.includes('upload:process');

    // The folder the file lives in decides which rule applies.
    const isAvatar = relativePath.startsWith('avatars/');
    const isUpload = relativePath.startsWith('uploads/');

    if (isAvatar) {
      if (await this.isOwnAvatar(relativePath, memberId)) return true;
      // The exam cell may need to look at a member's picture when
      // administering the college.
      return isExamCell;
    }

    if (isUpload) {
      if (await this.isOwnUpload(relativePath, memberId)) return true;
      return isExamCell;
    }

    /**
     * A file in neither folder is not attributable to anything this service
     * knows about, so it is the exam cell's alone.
     */
    return isExamCell;
  }

  /**
   * Refuses the read when the member may not have the file.
   */
  async assertMayRead(relativePath: string, memberId: string): Promise<void> {
    if (await this.mayRead(relativePath, memberId)) return;
    throw new ForbiddenException('You do not have access to this file.');
  }

  /** Whether the path is the member's own profile picture. */
  private async isOwnAvatar(relativePath: string, memberId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: memberId },
      select: { avatarUrl: true },
    });
    if (!user?.avatarUrl) return false;
    return this.storage.relativePathFromUrl(user.avatarUrl) === relativePath;
  }

  /** Whether the path is a file the member uploaded. */
  private async isOwnUpload(relativePath: string, memberId: string): Promise<boolean> {
    /**
     * The recorded URL is compared by path, not by string equality: the URL
     * may be absolute with a different host (a bucket URL against the
     * local `/files` route), while the path below it is the same.
     */
    const jobs = await this.prisma.uploadJob.findMany({
      where: { uploadedBy: memberId },
      select: { fileUrl: true },
    });

    return jobs.some((job) => this.storage.relativePathFromUrl(job.fileUrl) === relativePath);
  }
}
