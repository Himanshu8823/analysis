import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersRepository, type PublicUser, type UserWithRoles } from './users.repository';
import { MemberRevocationService } from './member-revocation.service';
import { MemberImpactService } from './member-impact.service';
import { CreateUserDto, ListMembersDto, UpdateUserDto } from './dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly repository: UsersRepository,
    private readonly config: ConfigService,
    private readonly revocation: MemberRevocationService,
    private readonly impact: MemberImpactService
  ) {}

  private get bcryptRounds(): number {
    return this.config.get<number>('auth.bcryptRounds') ?? 12;
  }

  /**
   * Creates a user with a bcrypt-hashed password.
   *
   * The hash is always computed here — the plaintext password never reaches the
   * repository, and no client-supplied hash is ever persisted.
   */
  async create(dto: CreateUserDto, createdBy: string): Promise<PublicUser> {
    const passwordHash = await bcrypt.hash(dto.password, this.bcryptRounds);
    const { password, ...rest } = dto;
    void password;
    return this.repository.create(rest, passwordHash, createdBy);
  }

  async findAll(params: { page?: number; pageSize?: number; search?: string; isActive?: boolean }) {
    return this.repository.findAll(params);
  }

  async findById(id: string): Promise<UserWithRoles> {
    const user = await this.repository.findById(id);
    if (!user) {
      throw new NotFoundException('That member no longer exists.');
    }
    return user;
  }

  /**
   * Lists members with their roles — the data source for the Members tab.
   */
  async findMembers(dto: ListMembersDto) {
    return this.repository.findMembers({
      search: dto.search,
      role: dto.role,
      branchId: dto.branchId,
      page: dto.page,
      pageSize: dto.pageSize,
    });
  }

  /** Lists every role with its member count — the data source for the Roles tab. */
  async findRoles() {
    return this.repository.findRolesWithCounts();
  }

  async update(id: string, dto: UpdateUserDto, updatedBy: string): Promise<UserWithRoles> {
    const { password, ...rest } = dto;
    const passwordHash =
      password !== undefined ? await bcrypt.hash(password, this.bcryptRounds) : undefined;
    return this.repository.update(id, rest, passwordHash, updatedBy);
  }

  /**
   * Archives a member.
   *
   * An archive and a revocation are the same act here — both end the
   * member's access and release what they held — so the archive goes through
   * the revocation lifecycle rather than setting a flag on its own.
   */
  async delete(id: string, deletedBy: string, reason: string): Promise<void> {
    await this.revocation.revoke(id, deletedBy, reason);
  }

  /**
   * Restores a revoked member.
   *
   * There is deliberately no separate "activate" that only flips the flag.
   * Restoring a member is a consequential act — it makes their account
   * usable again — so it goes through the revocation lifecycle's restore
   * path, which requires a reason, invalidates the cached permissions, and
   * records the change in the audit trail. A path that only sets `isActive`
   * would leave a member whose cached permissions are still stale until the
   * cache expires.
   */

  /**
   * Revokes a member's access.
   *
   * The full lifecycle — tokens, allocations, roles, invitations — is
   * performed by {@link MemberRevocationService}. This method exists so the
   * controller has one obvious place to call.
   */
  async deactivate(
    id: string,
    updatedBy: string,
    reason: string
  ): Promise<{ releasedAllocations: number; releasedClassAssignments: number }> {
    return this.revocation.revoke(id, updatedBy, reason);
  }

  /**
   * Restores a revoked member's account.
   *
   * The allocations and roles are **not** restored automatically — they were
   * released deliberately, and handing them back silently would undo the
   * administrator's decision without them knowing.
   */
  async restore(id: string, restoredBy: string, reason: string): Promise<void> {
    await this.revocation.restore(id, restoredBy, reason);
  }

  /**
   * What revoking this member would do, before it does it.
   */
  async revocationPreview(id: string) {
    return this.impact.previewRevocation(id);
  }

  /**
   * The consequences of a revocation, as sentences the administrator reads
   * before confirming.
   */
  async revocationConsequences(id: string): Promise<string[]> {
    return this.impact.describeRevocation(id);
  }
}
