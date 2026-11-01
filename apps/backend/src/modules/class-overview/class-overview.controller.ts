import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ClassOverviewService } from './class-overview.service';
import { Permissions, CurrentUser } from '@/common/decorators';
import type { JwtPayload } from '@/common/types';

/**
 * The class overview of the signed-in class teacher.
 *
 * The permission is `class_teacher_assignments:read` — the same one that
 * gates the class-teacher assignments themselves. Holding it is what makes
 * a member a class teacher, so it is exactly the right gate for a screen
 * that shows a class teacher's class.
 *
 * The routes are scoped to the session: there is no branch, semester or
 * teacher id in the path. A member can only ever read the classes they are
 * the class teacher of, whatever the client sends.
 */
@ApiTags('Class Overview')
@ApiBearerAuth()
@Controller('class-overview')
export class ClassOverviewController {
  constructor(private readonly service: ClassOverviewService) {}

  /**
   * The classes the signed-in member is the class teacher of.
   *
   * An empty array means the member is not a class teacher — that is a
   * valid state, not an error, so the page can say so plainly.
   */
  @Get()
  @Permissions('class_teacher_assignments:read')
  @ApiOperation({ summary: 'List the classes the signed-in member is the class teacher of' })
  async myClasses(@CurrentUser() user: JwtPayload) {
    return this.service.listMyClasses(user.sub);
  }

  /**
   * The overview of one of the signed-in member's classes.
   *
   * The class is addressed by the id of the member's own assignment, so a
   * class they do not teach is not addressable at all.
   */
  @Get(':assignmentId')
  @Permissions('class_teacher_assignments:read')
  @ApiOperation({ summary: "Get the overview of one of the signed-in member's classes" })
  async classOverview(
    @CurrentUser() user: JwtPayload,
    @Param('assignmentId') assignmentId: string
  ) {
    return this.service.getClassOverview(user.sub, assignmentId);
  }
}
