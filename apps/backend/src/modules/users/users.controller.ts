import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, ListMembersDto, UpdateUserDto, RevokeMemberDto } from './dto';
import { CurrentUser, Permissions, Audited, AuditAction, AuditResource } from '@/common/decorators';
import { parseOptionalInt, parseOptionalString } from '@/common/utils/query-params';
import type { JwtPayload } from '@/common/types';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Post()
  @Permissions('users:write')
  @Audited(AuditResource.USER, AuditAction.CREATE, {
    resourceIdSource: 'response',
    detailsFromBody: { email: 'email', name: 'name' },
  })
  @ApiOperation({ summary: 'Create new user' })
  async create(@Body() dto: CreateUserDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }

  @Get()
  @Permissions('users:read')
  @ApiOperation({ summary: 'List users (paginated)' })
  async findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string
  ) {
    return this.service.findAll({
      page: parseOptionalInt(page),
      pageSize: parseOptionalInt(pageSize),
      search: parseOptionalString(search),
      isActive: isActive === undefined ? undefined : isActive === 'true',
    });
  }

  /**
   * Lists members with their assigned roles.
   *
   * Declared before `:id` so the literal path wins over the parameter route.
   */
  @Get('members')
  @Permissions('users:read')
  @ApiOperation({ summary: 'List members with their roles' })
  async findMembers(@Query() dto: ListMembersDto) {
    return this.service.findMembers(dto);
  }

  /** Lists the roles that can be assigned, with member counts. */
  @Get('roles')
  @Permissions('users:read')
  @ApiOperation({ summary: 'List roles with member counts' })
  async findRoles() {
    return this.service.findRoles();
  }

  /**
   * What revoking this member would do.
   *
   * The member edit screen calls this before showing the confirmation, so the
   * administrator sees the consequences — how many allocations, which classes
   * will lose their teacher — before committing to it.
   */
  @Get(':id/revocation-impact')
  @Permissions('users:write')
  @ApiOperation({
    summary: 'Preview what revoking this member would affect',
    description:
      'Returns the number of subject allocations and class teacher assignments ' +
      'that would be released, and the consequences in plain language.',
  })
  async revocationImpact(@Param('id') id: string) {
    const impact = await this.service.revocationPreview(id);
    const consequences = await this.service.revocationConsequences(id);
    return { ...impact, consequences };
  }

  @Get(':id')
  @Permissions('users:read')
  async findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Put(':id')
  @Permissions('users:write')
  @Audited(AuditResource.USER, AuditAction.UPDATE, {
    resourceIdSource: 'param',
    detailsFromBody: { name: 'name', email: 'email' },
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: JwtPayload
  ) {
    return this.service.update(id, dto, user.sub);
  }

  /**
   * Revokes a member's access.
   *
   * The full lifecycle runs here: the account is deactivated, every session
   * is revoked, pending invitations are withdrawn, subject allocations and
   * class teacher assignments are released, and the roles are removed. A
   * reason is required and is recorded in the audit trail.
   */
  @Delete(':id')
  @Permissions('users:write')
  @Audited(AuditResource.USER, AuditAction.DEACTIVATE, {
    resourceIdSource: 'param',
    detailsFromBody: { reason: 'reason' },
  })
  async delete(
    @Param('id') id: string,
    @Body() dto: RevokeMemberDto,
    @CurrentUser() user: JwtPayload
  ): Promise<void> {
    await this.service.delete(id, user.sub, dto.reason);
  }

  /**
   * Restores a revoked member's account.
   *
   * Their allocations and roles are not restored automatically — they were
   * released deliberately, and the administrator re-applies them by hand.
   */
  @Post(':id/restore')
  @Permissions('users:write')
  @Audited(AuditResource.USER, AuditAction.UPDATE, {
    resourceIdSource: 'param',
    detailsFromBody: { reason: 'reason' },
  })
  async restore(
    @Param('id') id: string,
    @Body() dto: RevokeMemberDto,
    @CurrentUser() user: JwtPayload
  ): Promise<void> {
    await this.service.restore(id, user.sub, dto.reason);
  }
}
