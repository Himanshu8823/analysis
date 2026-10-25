import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersRepository, type PublicUser, type UserWithRoles } from './users.repository';
import { CreateUserDto, ListMembersDto, UpdateUserDto } from './dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly repository: UsersRepository,
    private readonly config: ConfigService
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
      throw new NotFoundException('User not found');
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

  async delete(id: string, deletedBy: string): Promise<void> {
    await this.repository.softDelete(id, deletedBy);
  }

  async activate(id: string, updatedBy: string): Promise<UserWithRoles> {
    return this.repository.update(id, { isActive: true }, undefined, updatedBy);
  }

  async deactivate(id: string, updatedBy: string): Promise<UserWithRoles> {
    return this.repository.update(id, { isActive: false }, undefined, updatedBy);
  }
}
