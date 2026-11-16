import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AuthorisationService } from '@/common/services/authorisation.service';

/**
 * Why a mark write was refused.
 *
 * The reason travels with the exception so the caller can tell a colleague's
 * allocation from a missing permission — and so the audit trail can record
 * which rule stopped the write.
 */
export type MarkWriteRefusal = 'NOT_ALLOCATED' | 'HELD_BY_TEACHER' | 'NO_PERMISSION';

/**
 * The rule that decides who may write a mark for a subject offering.
 *
 * The college's rule is that **the exam cell defines what a subject is worth,
 * and the teacher writes what a student scored**. So:
 *
 *  - A **teacher** (`marks:enter_own_subject`) may write only for the
 *    offerings the HOD allocated to them, for that academic year. Being the
 *    class teacher of a class grants nothing here.
 *  - An **exam-cell member** (`marks:write`) may write for any offering in
 *    their scope — with one exception: an offering a teacher holds an
 *    allocation for. That exception exists because a published score the
 *    teacher owns should not be quietly overwritten by the exam cell. The
 *    exam cell can still correct it, but only through the deliberate,
 *    reasoned, audited correction flow.
 *
 * Every write path — single create, bulk create, update, delete and the
 * upload-confirm path — comes through this service, so none of them can
 * bypass the rule.
 */
@Injectable()
export class MarksAuthorisationService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly authorisation: AuthorisationService
  ) {}

  /**
   * Decides whether the caller may write a mark for the given offering.
   *
   * @param userId        The caller.
   * @param subjectOfferingId The offering the mark belongs to.
   * @param academicYearId    The year the mark is for.
   * @param options.isCorrection Whether this is the exam cell's explicit
   *   correction of a teacher's subject. Only an exam-cell write may set it.
   *
   * @returns The teacher whose allocation the write overrides, when there is
   *   one and the caller is not that teacher. A correction records this on
   *   the revision row, so the question "whose work did this overwrite?" has
   *   an answer.
   */
  async assertMayWrite(
    userId: string,
    subjectOfferingId: string,
    academicYearId: string,
    options: { isCorrection?: boolean } = {}
  ): Promise<{ overriddenTeacher: { id: string; name: string } | null }> {
    const permissions = await this.authorisation.permissionsOf(userId);

    const isExamCell = permissions.includes('marks:write');
    const isTeacher = permissions.includes('marks:enter_own_subject');

    if (!isExamCell && !isTeacher) {
      throw new ForbiddenException(
        'You do not have permission to enter marks. Ask the college administrator if you need it.'
      );
    }

    // A correction is an exam-cell operation. A teacher may never use it.
    if (options.isCorrection) {
      if (!isExamCell) {
        throw new ForbiddenException(
          'Only the examination cell can correct marks that a teacher has entered.'
        );
      }
      // The exam cell may correct any offering in its scope. Scope is
      // checked by the caller, which knows the offering's branch.
      const holder = await this.authorisation.allocatedTeacher(subjectOfferingId, academicYearId);
      return {
        overriddenTeacher: holder && holder.id !== userId ? holder : null,
      };
    }

    // A teacher may write only what they were allocated.
    if (isTeacher && !isExamCell) {
      const allocated = await this.authorisation.isAllocated(
        userId,
        subjectOfferingId,
        academicYearId
      );
      if (!allocated) {
        const subject = await this.subjectName(subjectOfferingId);
        throw new ForbiddenException(
          `You are not allocated to ${subject}, so you cannot enter its marks.`
        );
      }
      return { overriddenTeacher: null };
    }

    /**
     * The exam cell writes freely — unless a teacher holds this subject, in
     * which case the write must be an explicit correction.
     */
    if (isExamCell) {
      const holder = await this.authorisation.allocatedTeacher(subjectOfferingId, academicYearId);
      if (holder && holder.id !== userId) {
        const subject = await this.subjectName(subjectOfferingId);
        throw new ForbiddenException(
          `${subject} is entered by ${holder.name}. To change it, use "Correct marks" ` +
            'and give a reason — the change is recorded against your name.'
        );
      }
      return { overriddenTeacher: null };
    }

    return { overriddenTeacher: null };
  }

  /**
   * Decides whether the caller may write a **batch** of marks.
   *
   * A batch is refused as a whole. "47 of 50 saved" is never a state the
   * marks screen can be in — a teacher who is half-way through a spreadsheet
   * would not know which half was written.
   *
   * @param entries The rows about to be written, each with its offering and
   *   academic year.
   * @param options.isCorrection Whether this is an exam-cell correction.
   */
  async assertMayWriteBulk(
    userId: string,
    entries: Array<{ subjectOfferingId: string; academicYearId: string }>,
    options: { isCorrection?: boolean } = {}
  ): Promise<void> {
    if (!entries.length) return;

    // Group by offering so each distinct offering is checked once.
    const distinct = new Map<string, Set<string>>();
    for (const entry of entries) {
      const years = distinct.get(entry.subjectOfferingId) ?? new Set<string>();
      years.add(entry.academicYearId);
      distinct.set(entry.subjectOfferingId, years);
    }

    for (const [offeringId, years] of distinct) {
      for (const yearId of years) {
        await this.assertMayWrite(userId, offeringId, yearId, options);
      }
    }
  }

  /**
   * The subject's name, for the refusal message.
   *
   * A refusal that names the subject ("you are not allocated to Computer
   * Networks") is understandable; one that names an id is not.
   */
  private async subjectName(subjectOfferingId: string): Promise<string> {
    const offering = await this.prisma.subjectOffering.findUnique({
      where: { id: subjectOfferingId },
      select: { subject: { select: { name: true } } },
    });
    return offering?.subject.name ?? 'this subject';
  }
}
