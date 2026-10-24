import { Module } from '@nestjs/common';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { RolesRepository } from './roles.repository';
import { PermissionsController } from './permissions.controller';
import { PermissionsService } from './permissions.service';
import { PermissionsRepository } from './permissions.repository';
import { PermissionsCacheRepository } from './permissions-cache.repository';
import { UserRolesController } from './user-roles.controller';
import { UserRolesService } from './user-roles.service';
import { UserRolesRepository } from './user-roles.repository';

@Module({
  controllers: [RolesController, PermissionsController, UserRolesController],
  providers: [
    RolesService,
    RolesRepository,
    PermissionsService,
    PermissionsRepository,
    PermissionsCacheRepository,
    UserRolesService,
    UserRolesRepository,
  ],
  exports: [RolesService, PermissionsService, UserRolesService, PermissionsCacheRepository],
})
export class RbacModule {}
