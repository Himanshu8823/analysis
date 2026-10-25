import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRolesService } from './user-roles.service';
import { AssignRoleDto, RevokeRoleDto } from './dto';
import { Permissions, CurrentUser } from '@/common/decorators';
import type { JwtPayload } from '@/common/types';

@ApiTags('RBAC - User Roles')
@ApiBearerAuth()
@Controller('user-roles')
export class UserRolesController {
  constructor(private readonly service: UserRolesService) {}

  @Post()
  @Permissions('rbac:write')
  @ApiOperation({ summary: 'Assign role to user' })
  async assign(@Body() dto: AssignRoleDto, @CurrentUser() user: JwtPayload) {
    return this.service.assign(dto, user.sub);
  }

  @Delete()
  @Permissions('rbac:write')
  async revoke(@Body() dto: RevokeRoleDto): Promise<void> {
    return this.service.revoke(dto);
  }

  @Get(':userId')
  @Permissions('rbac:read')
  async findByUser(@Param('userId') userId: string) {
    return this.service.findByUser(userId);
  }
}
