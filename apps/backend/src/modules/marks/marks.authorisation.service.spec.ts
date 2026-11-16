/**
 * The tests for who may write a mark.
 *
 * The rule this file protects is the one the college runs on: **the exam
 * cell defines what a subject is worth, and the teacher writes what a
 * student scored.** It is the rule behind the user's own complaint — *"the
 * admin can put marks for a subject, and that is wrong"* — and it is the
 * rule that the permission decorators alone cannot express, because the
 * decorators say what a member may do and not whose subject they may do it
 * to.
 *
 * The tests below are about the three cases that matter:
 *
 *  - a teacher may write only what they were allocated;
 *  - the exam cell may write any offering in scope, but **not** one a
 *    teacher holds — that is a correction, and a correction is a different
 *    operation with a reason and an audit trail;
 *  - a correction returns the teacher whose work it overrides, so the
 *    original entry can be preserved rather than lost.
 */

import { ForbiddenException } from '@nestjs/common';
import { MarksAuthorisationService } from './marks.authorisation.service';

/**
 * A stand-in for the authorisation service.
 *
 * The authorisation service answers "what may this member do?" and "who
 * holds this offering?". Those are the only two questions the marks
 * authorisation asks it.
 */
function authorisationWith(options: {
  permissions: string[];
  allocated?: boolean;
  holder?: { id: string; name: string } | null;
}) {
  return {
    permissionsOf: jest.fn().mockResolvedValue(options.permissions),
    isAllocated: jest.fn().mockResolvedValue(options.allocated ?? false),
    allocatedTeacher: jest.fn().mockResolvedValue(options.holder ?? null),
  };
}

/**
 * A stand-in for the database, which is only asked for the subject's name —
 * the thing a refusal message uses so the member knows *which* subject.
 */
function prismaWithSubject(name = 'Computer Networks'): {
  subjectOffering: { findUnique: jest.Mock };
} {
  return {
    subjectOffering: {
      findUnique: jest.fn().mockResolvedValue({ subject: { name } }),
    },
  };
}

const OFFERING = 'offering-1';
const YEAR = 'year-1';

describe('who may write a mark', () => {
  describe('a member with neither right', () => {
    it('is refused', async () => {
      const service = new MarksAuthorisationService(
        prismaWithSubject() as never,
        authorisationWith({ permissions: ['students:read'] }) as never
      );

      await expect(service.assertMayWrite('member-1', OFFERING, YEAR)).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  describe('a teacher', () => {
    it('may write a subject they were allocated', async () => {
      const service = new MarksAuthorisationService(
        prismaWithSubject() as never,
        authorisationWith({
          permissions: ['marks:enter_own_subject'],
          allocated: true,
        }) as never
      );

      await expect(service.assertMayWrite('teacher-1', OFFERING, YEAR)).resolves.toEqual({
        overriddenTeacher: null,
      });
    });

    it('may not write a subject they were not allocated', async () => {
      const service = new MarksAuthorisationService(
        prismaWithSubject('Computer Networks') as never,
        authorisationWith({
          permissions: ['marks:enter_own_subject'],
          allocated: false,
        }) as never
      );

      /**
       * The message names the subject, because a refusal that names an id
       * is not one a college clerk can act on.
       */
      await expect(service.assertMayWrite('teacher-1', OFFERING, YEAR)).rejects.toThrow(
        /not allocated to Computer Networks/
      );
    });

    it('may never use the correction flow', async () => {
      const service = new MarksAuthorisationService(
        prismaWithSubject() as never,
        authorisationWith({
          permissions: ['marks:enter_own_subject'],
          allocated: true,
        }) as never
      );

      await expect(
        service.assertMayWrite('teacher-1', OFFERING, YEAR, { isCorrection: true })
      ).rejects.toThrow(/Only the examination cell/);
    });

    it('is not told that they overrode anybody', async () => {
      const service = new MarksAuthorisationService(
        prismaWithSubject() as never,
        authorisationWith({
          permissions: ['marks:enter_own_subject'],
          allocated: true,
          holder: { id: 'teacher-2', name: 'Someone Else' },
        }) as never
      );

      const result = await service.assertMayWrite('teacher-1', OFFERING, YEAR);

      expect(result.overriddenTeacher).toBeNull();
    });
  });

  describe('the exam cell', () => {
    it('may write an offering no teacher holds', async () => {
      const service = new MarksAuthorisationService(
        prismaWithSubject() as never,
        authorisationWith({
          permissions: ['marks:write'],
          holder: null,
        }) as never
      );

      await expect(service.assertMayWrite('admin-1', OFFERING, YEAR)).resolves.toEqual({
        overriddenTeacher: null,
      });
    });

    it('may not quietly overwrite a teacher’s subject', async () => {
      const service = new MarksAuthorisationService(
        prismaWithSubject('Computer Networks') as never,
        authorisationWith({
          permissions: ['marks:write'],
          holder: { id: 'teacher-1', name: 'Mrs Rao' },
        }) as never
      );

      /**
       * The refusal points at the correction flow, because there is one —
       * it is a different operation with a reason and an audit trail.
       */
      await expect(service.assertMayWrite('admin-1', OFFERING, YEAR)).rejects.toThrow(/Mrs Rao/);
      await expect(service.assertMayWrite('admin-1', OFFERING, YEAR)).rejects.toThrow(
        /Correct marks/
      );
    });

    it('may correct a teacher’s subject, and is told whose work it replaces', async () => {
      const service = new MarksAuthorisationService(
        prismaWithSubject() as never,
        authorisationWith({
          permissions: ['marks:write'],
          holder: { id: 'teacher-1', name: 'Mrs Rao' },
        }) as never
      );

      const result = await service.assertMayWrite('admin-1', OFFERING, YEAR, {
        isCorrection: true,
      });

      /**
       * The overridden teacher is returned so that the revision row can
       * name them. Without it, "who changed this score?" has no answer.
       */
      expect(result.overriddenTeacher).toEqual({ id: 'teacher-1', name: 'Mrs Rao' });
    });

    it('is not told it overrode itself', async () => {
      const service = new MarksAuthorisationService(
        prismaWithSubject() as never,
        authorisationWith({
          permissions: ['marks:write'],
          holder: { id: 'admin-1', name: 'The Exam Cell' },
        }) as never
      );

      const result = await service.assertMayWrite('admin-1', OFFERING, YEAR, {
        isCorrection: true,
      });

      expect(result.overriddenTeacher).toBeNull();
    });
  });

  describe('a batch of marks', () => {
    it('is refused as a whole when one row may not be written', async () => {
      const service = new MarksAuthorisationService(
        prismaWithSubject() as never,
        authorisationWith({
          permissions: ['marks:enter_own_subject'],
          allocated: false,
        }) as never
      );

      /**
       * "47 of 50 saved" is never a state the marks screen can be in — a
       * member who was half-way through a spreadsheet would not know which
       * half was written.
       */
      await expect(
        service.assertMayWriteBulk('teacher-1', [
          { subjectOfferingId: OFFERING, academicYearId: YEAR },
          { subjectOfferingId: 'offering-2', academicYearId: YEAR },
        ])
      ).rejects.toThrow(ForbiddenException);
    });

    it('is allowed when every row may be written', async () => {
      const service = new MarksAuthorisationService(
        prismaWithSubject() as never,
        authorisationWith({
          permissions: ['marks:enter_own_subject'],
          allocated: true,
        }) as never
      );

      await expect(
        service.assertMayWriteBulk('teacher-1', [
          { subjectOfferingId: OFFERING, academicYearId: YEAR },
          { subjectOfferingId: 'offering-2', academicYearId: YEAR },
        ])
      ).resolves.toBeUndefined();
    });

    it('is allowed when it is empty', async () => {
      const service = new MarksAuthorisationService(
        prismaWithSubject() as never,
        authorisationWith({ permissions: ['marks:write'] }) as never
      );

      await expect(service.assertMayWriteBulk('admin-1', [])).resolves.toBeUndefined();
    });
  });
});
