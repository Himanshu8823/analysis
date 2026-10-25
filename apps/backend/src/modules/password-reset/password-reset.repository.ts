import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PasswordResetRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /** Invalidates any outstanding reset links for the account. */
  async revokeOutstanding(userId: string): Promise<void> {
    await this.prisma.passwordReset.deleteMany({
      where: { userId, usedAt: null },
    });
  }

  async create(data: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void> {
    await this.prisma.passwordReset.create({
      data: {
        userId: data.userId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
      },
    });
  }

  /** Finds an unused reset request by its token hash. */
  async findByTokenHash(tokenHash: string) {
    return this.prisma.passwordReset.findUnique({ where: { tokenHash } });
  }

  /** Marks the request as consumed. */
  async markUsed(id: string): Promise<void> {
    await this.prisma.passwordReset.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }
}
