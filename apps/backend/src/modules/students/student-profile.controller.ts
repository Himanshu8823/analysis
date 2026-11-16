import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AnyPermission, CurrentUser } from '@/common/decorators';
import type { JwtPayload } from '@/common/types';
import { StudentProfileService } from './student-profile.service';

/**
 * The student's profile.
 *
 * It is its own controller rather than a route on the roster controller
 * because it is a different concern: the roster is the exam cell's list,
 * and the profile is a *view* whose contents depend on who is asking. A
 * separate controller makes that separation visible in the route table.
 */
@ApiTags('Student Profile')
@ApiBearerAuth()
@Controller('students')
export class StudentProfileController {
  constructor(private readonly profileService: StudentProfileService) {}

  /**
   * The whole profile of one student.
   *
   * The response is assembled by the service, which decides what this
   * caller may see. A caller who may not read a section does not receive
   * it at all — the key is absent from the payload, not present and
   * blank.
   *
   * The route is open to a member who may read **either** the roster
   * (`students:read` — the exam cell, the HOD, the teacher) **or** their own
   * record (`students:read_own` — the student themself). They are
   * alternatives, not a conjunction: a student holds the second and not the
   * first, and requiring both would make the screen unreachable for exactly
   * the person it most obviously exists for.
   *
   * Which sections come back is decided by the service, not here.
   */
  @Get(':id/profile')
  @AnyPermission('students:read', 'students:read_own')
  @ApiOperation({
    summary: 'Get one student’s full profile, scoped to the caller’s permissions',
    description:
      'Returns the identity block, the academic snapshot, the marks and result ' +
      'history, the documents and the activity trail — each included only if ' +
      'the caller is entitled to it. Sensitive identity data and guardian ' +
      'details are omitted entirely for callers without the matching right.',
  })
  async profile(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.profileService.buildProfile(id, user.sub);
  }
}
