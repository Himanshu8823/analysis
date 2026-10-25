import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Permissions } from '@/common/decorators';
import { parseOptionalInt } from '@/common/utils/query-params';
import type { JwtPayload } from '@/common/types';
import { StudentSelfService } from './student-self.service';

/**
 * The controller for everything a student can see of their own academic
 * record.
 *
 * It lives in its own file rather than in `students.controller.ts` because
 * the student-scoped routes are a different concern from the exam cell's
 * roster management: these routes never accept a student id from the client
 * as the target of the read.
 */
@ApiTags('My Result')
@ApiBearerAuth()
@Controller()
export class MyResultController {
  constructor(private readonly selfService: StudentSelfService) {}

  /**
   * The logged-in student's own result.
   *
   * The student is resolved from the JWT — there is no `studentId`
   * parameter, so a student cannot ask for anybody else's result.
   */
  @Get('my-result')
  @Permissions('students:read_own')
  @ApiOperation({ summary: 'Get my own result for my class' })
  async myResult(@CurrentUser() user: JwtPayload) {
    return this.selfService.buildMyResult(user.sub);
  }

  /**
   * The leaderboard of the logged-in student's own class.
   *
   * The class is derived from the student's own record (branch, semester,
   * scheme, academic year), so the caller cannot widen the window.
   */
  @Get('my-toppers')
  @Permissions('toppers:read_own_class')
  @ApiOperation({ summary: 'Get the toppers of my own class' })
  async myToppers(@CurrentUser() user: JwtPayload, @Query('limit') limit?: string) {
    return this.selfService.buildMyToppers(user.sub, parseOptionalInt(limit));
  }

  /**
   * The owner-scoped read of the student's own record.
   *
   * The same information as the student block of `my-result`, exposed on
   * its own for screens that only need the identity.
   */
  @Get('my/student')
  @Permissions('students:read_own')
  @ApiOperation({ summary: 'Get my own student record' })
  async myStudent(@CurrentUser() user: JwtPayload) {
    return this.selfService.requireStudentForUser(user.sub);
  }

  /**
   * The owner-scoped read of a single student record.
   *
   * The id must belong to the caller — anything else is rejected with a 403
   * rather than silently returning somebody else's data.
   */
  @Get('my/student/:studentId')
  @Permissions('students:read_own')
  @ApiOperation({ summary: 'Get one of my own student records' })
  async myStudentById(@CurrentUser() user: JwtPayload, @Param('studentId') studentId: string) {
    return this.selfService.assertOwnsStudent(user.sub, studentId);
  }
}
