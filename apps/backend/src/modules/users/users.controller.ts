import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, ListMembersDto, UpdateUserDto } from './dto';
import { CurrentUser, Permissions } from '@/common/decorators';
import { parseOptionalInt, parseOptionalString } from '@/common/utils/query-params';
import type { JwtPayload } from '@/common/types';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Post()
  @Permissions('users:write')
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

  @Get(':id')
  @Permissions('users:read')
  async findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Put(':id')
  @Permissions('users:write')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: JwtPayload
  ) {
    return this.service.update(id, dto, user.sub);
  }

  @Delete(':id')
  @Permissions('users:write')
  async delete(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<void> {
    return this.service.delete(id, user.sub);
  }
}
