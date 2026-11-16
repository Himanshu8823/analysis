/**
 * The test that proves the PII gate works.
 *
 * ## What is being tested
 *
 * The profile screen shows a student's personal data. Some of it is
 * sensitive:
 *
 *  - the **national identity reference** (Aadhaar or equivalent), which
 *    only the examination cell and the Super Admin may read;
 *  - the **guardian's contact details**, which the Principal and the HOD
 *    may read but a teacher may not;
 *  - the **marks**, which a teacher may read only for the subjects they
 *    were allocated.
 *
 * The gate is enforced by **omission**: a field the caller may not read
 * never appears in the response payload at all. This test asserts that
 * absence directly — not by checking that a value is `null` or masked,
 * which would still leave the data in the payload.
 *
 * ## Why this matters
 *
 * The alternative design — send everything, let the frontend hide it — puts
 * the security boundary in the client. A forgotten `className` in a table
 * header would publish a student's Aadhaar number to every teacher in the
 * college. With omission, that mistake is impossible: the value was never
 * sent.
 */

import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import { StudentProfileService } from './student-profile.service';
import { AuthorisationService } from '@/common/services/authorisation.service';
import { MarksScopeService } from '../marks/marks-scope.service';

/**
 * The student record the fake database holds.
 *
 * Every field the profile service reads is present, including the
 * sensitive ones — so a test can prove that a sensitive value is *absent
 * from the response* rather than merely absent from the database.
 */
function studentRecord() {
  return {
    id: 'student-1',
    rollNo: 'CS2022-001',
    name: 'Aarav Sharma',
    email: 'aarav@example.com',
    userId: null,
    branchId: 'branch-1',
    semester: 5,
    schemeId: 'scheme-1',
    batchId: 'batch-1',
    academicYearId: 'year-1',
    admissionYear: 2022,
    section: 'A',
    isActive: true,
    createdAt: new Date('2022-07-01'),
    updatedAt: new Date('2022-07-01'),
    createdBy: null,
    updatedBy: null,
    dateOfBirth: new Date('2003-07-14'),
    gender: 'MALE',
    phone: '9876543210',
    alternateEmail: null,
    address: '12, Shivaji Nagar',
    city: 'Nashik',
    state: 'Maharashtra',
    pincode: '422001',
    photoUrl: null,
    bloodGroup: 'B_POS',
    nationalId: '1234-5678-9012',
    reservedCategory: 'OBC',
    feeCategory: 'REGULAR',
    scholarshipRecipient: true,
    guardianName: 'Ramesh Sharma',
    guardianRelation: 'FATHER',
    guardianPhone: '9876500000',
    guardianEmail: 'ramesh@example.com',
    guardianOccupation: 'Farmer',
    guardian2Name: null,
    guardian2Relation: null,
    guardian2Phone: null,
    guardian2Email: null,
    guardian2Occupation: null,
    status: 'ACTIVE',
    statusReason: null,
    statusDate: new Date('2022-07-01'),
    branch: { id: 'branch-1', code: 'CS', name: 'Computer Science & Engineering' },
    scheme: { id: 'scheme-1', name: 'SCHEME_2022' },
    batch: { id: 'batch-1', name: '2022-26 cohort' },
    academicYear: { id: 'year-1', year: '2024-25' },
  };
}

/**
 * A stand-in for the Prisma client.
 *
 * Only the reads the profile service performs are implemented — every
 * method that is not implemented throws, so a query the service starts
 * making (and forgets to scope) fails the test loudly rather than
 * silently returning nothing.
 */
function makePrisma(overrides: Record<string, unknown> = {}): PrismaClient {
  const prisma = {
    student: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        where.id === 'student-1' ? studentRecord() : null
      ),
      findFirst: jest.fn(async () => null),
    },
    studentEnrollment: {
      findMany: jest.fn(async () => []),
    },
    subjectOffering: {
      findMany: jest.fn(async () => []),
    },
    teacherSubject: {
      findMany: jest.fn(async () => []),
    },
    mark: {
      findMany: jest.fn(async () => []),
    },
    academicYear: {
      findUnique: jest.fn(async () => ({ year: '2024-25' })),
    },
    scheme: {
      findUnique: jest.fn(async () => ({ name: 'SCHEME_2022' })),
    },
    examination: {
      findUnique: jest.fn(async () => null),
    },
    report: {
      findMany: jest.fn(async () => []),
    },
    uploadJob: {
      findMany: jest.fn(async () => []),
    },
    auditLog: {
      findMany: jest.fn(async () => []),
    },
    ...overrides,
  };

  return prisma as unknown as PrismaClient;
}

/**
 * An authorisation service that reports a fixed set of permissions.
 */
function makeAuthorisation(permissions: string[]): AuthorisationService {
  return {
    permissionsOf: jest.fn(async () => permissions),
    has: jest.fn(async (_userId: string, permission: string) => permissions.includes(permission)),
    assertAnyPermission: jest.fn(async () => undefined),
    branchScope: jest.fn(async () => []),
    resolveBranchFilter: jest.fn(async () => undefined),
    resolveBranchScope: jest.fn(async () => undefined),
    assertBranchWritable: jest.fn(async () => undefined),
    assertBranchVisible: jest.fn(async () => undefined),
    allocatedOfferingIds: jest.fn(async () => []),
    isAllocated: jest.fn(async () => false),
    allocatedTeacher: jest.fn(async () => null),
    classesTaughtBy: jest.fn(async () => []),
    isClassTeacherOf: jest.fn(async () => false),
    branchOfStudent: jest.fn(async () => 'branch-1'),
    assertExists: jest.fn((record: unknown) => record),
  } as unknown as AuthorisationService;
}

function makeMarksScope(): MarksScopeService {
  return {} as MarksScopeService;
}

/**
 * Builds the service with the given caller's permissions.
 */
async function buildService(
  permissions: string[],
  prismaOverrides: Record<string, unknown> = {}
): Promise<StudentProfileService> {
  const module = await Test.createTestingModule({
    providers: [
      StudentProfileService,
      { provide: PrismaClient, useValue: makePrisma(prismaOverrides) },
      { provide: AuthorisationService, useValue: makeAuthorisation(permissions) },
      { provide: MarksScopeService, useValue: makeMarksScope() },
    ],
  }).compile();

  return module.get(StudentProfileService);
}

/**
 * The stringified payload, so a test can assert that a value is nowhere in
 * it — not merely that it is absent from a known key.
 */
function serialise(payload: unknown): string {
  return JSON.stringify(payload);
}

describe('the student profile and the sensitive fields', () => {
  /**
   * The examination cell sees everything — it recorded the data.
   */
  it('gives the exam cell the sensitive identity block', async () => {
    const service = await buildService([
      'students:read',
      'students:read_sensitive',
      'students:read_guardian',
    ]);

    const profile = await service.buildProfile('student-1', 'caller-1');

    expect(profile.identity.sensitive).toBeDefined();
    expect(profile.identity.sensitive?.nationalId).toBe('1234-5678-9012');
    expect(profile.identity.sensitive?.bloodGroup).toBe('B_POS');
    expect(profile.identity.guardians).toBeDefined();
    expect(profile.identity.guardians?.primary?.phone).toBe('9876500000');
  });

  /**
   * A teacher must NOT see the national identity number, and must NOT see
   * the guardian's phone number.
   *
   * This is the exact requirement of §2.8.1, and it is asserted against
   * the *serialised payload* — so a leak through any field, however deeply
   * nested, fails the test.
   */
  it('gives a teacher neither the national id nor the guardian phone', async () => {
    const service = await buildService(['students:read', 'marks:read', 'marks:enter_own_subject']);

    const profile = await service.buildProfile('student-1', 'teacher-1');
    const payload = serialise(profile);

    // The sensitive block is not in the payload at all.
    expect(profile.identity.sensitive).toBeUndefined();
    expect(payload).not.toContain('nationalId');
    expect(payload).not.toContain('1234-5678-9012');
    expect(payload).not.toContain('bloodGroup');

    // The guardian block is not in the payload at all.
    expect(profile.identity.guardians).toBeUndefined();
    expect(payload).not.toContain('guardianPhone');
    expect(payload).not.toContain('9876500000');
    expect(payload).not.toContain('Ramesh Sharma');
  });

  /**
   * The Principal sees the academic picture without the sensitive identity
   * data — but the guardian's contact details are part of the picture.
   */
  it('gives the Principal the guardians but not the national id', async () => {
    const service = await buildService([
      'students:read',
      'students:read_guardian',
      'marks:read',
      'audit:read',
    ]);

    const profile = await service.buildProfile('student-1', 'principal-1');
    const payload = serialise(profile);

    expect(profile.identity.sensitive).toBeUndefined();
    expect(payload).not.toContain('nationalId');
    expect(payload).not.toContain('1234-5678-9012');

    expect(profile.identity.guardians).toBeDefined();
    expect(profile.identity.guardians?.primary?.phone).toBe('9876500000');
  });

  /**
   * A teacher sees the marks of the subjects they were allocated, and the
   * rest is absent — not blank.
   */
  it('narrows a teacher’s marks to the subjects they are allocated', async () => {
    const allocatedOfferingId = 'offering-allocated';

    const markFindMany = jest.fn(
      async (args: { where: { subjectOfferingId?: { in: string[] } } }) => {
        // The offering filter the service applied is the teacher's boundary.
        const allowed = args.where.subjectOfferingId?.in ?? [];
        if (!allowed.includes(allocatedOfferingId)) return [];
        return [];
      }
    );

    const service = await buildService(['students:read', 'marks:enter_own_subject'], {
      teacherSubject: {
        findMany: jest.fn(async () => [{ subjectOfferingId: allocatedOfferingId }]),
      },
      mark: { findMany: markFindMany },
    });

    const profile = await service.buildProfile('student-1', 'teacher-1');

    // The notice explains the narrowing in plain language.
    expect(profile.restrictedNotice).toBeDefined();
    expect(profile.restrictedNotice).toContain('not visible to you');

    // Every mark query was bounded by the allocation.
    for (const call of markFindMany.mock.calls) {
      const where = (call[0] as { where: { subjectOfferingId?: { in: string[] } } }).where;
      if (where.subjectOfferingId) {
        expect(where.subjectOfferingId.in).toEqual([allocatedOfferingId]);
      }
    }
  });

  /**
   * A teacher with no allocation sees no marks at all — and is told why.
   */
  it('gives a teacher with no allocation no marks, and says so', async () => {
    const service = await buildService(['students:read', 'marks:enter_own_subject']);

    const profile = await service.buildProfile('student-1', 'teacher-1');

    expect(profile.academic).toBeUndefined();
    expect(profile.marksHistory).toBeUndefined();
    expect(profile.resultHistory).toBeUndefined();
    expect(profile.restrictedNotice).toContain('not allocated');
  });

  /**
   * A student may read their own record — and their own identity number,
   * because it is their own business.
   */
  it('gives a student their own record, and refuses anybody else’s', async () => {
    const prisma = makePrisma({
      student: {
        findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
          where.id === 'student-1' ? studentRecord() : null
        ),
        findFirst: jest.fn(async () => ({ id: 'student-1' })),
      },
    });

    const module = await Test.createTestingModule({
      providers: [
        StudentProfileService,
        { provide: PrismaClient, useValue: prisma },
        { provide: AuthorisationService, useValue: makeAuthorisation(['students:read_own']) },
        { provide: MarksScopeService, useValue: makeMarksScope() },
      ],
    }).compile();
    const service = module.get(StudentProfileService);

    // Somebody else's record is refused.
    await expect(service.buildProfile('student-2', 'student-user-1')).rejects.toBeInstanceOf(
      ForbiddenException
    );

    // Their own record is theirs.
    const profile = await service.buildProfile('student-1', 'student-user-1');
    expect(profile.identity.id).toBe('student-1');
    expect(profile.identity.sensitive?.nationalId).toBe('1234-5678-9012');
    expect(profile.identity.guardians?.primary?.phone).toBe('9876500000');
  });

  /**
   * A student account with no linked record is told to contact the exam
   * cell, in the language the rest of the system uses.
   */
  it('tells a student with no linked record to contact the examination cell', async () => {
    const prisma = makePrisma({
      student: {
        findUnique: jest.fn(async () => null),
        findFirst: jest.fn(async () => null),
      },
    });

    const module = await Test.createTestingModule({
      providers: [
        StudentProfileService,
        { provide: PrismaClient, useValue: prisma },
        { provide: AuthorisationService, useValue: makeAuthorisation(['students:read_own']) },
        { provide: MarksScopeService, useValue: makeMarksScope() },
      ],
    }).compile();
    const service = module.get(StudentProfileService);

    await expect(service.buildProfile('student-1', 'student-user-1')).rejects.toBeInstanceOf(
      NotFoundException
    );
    await expect(service.buildProfile('student-1', 'student-user-1')).rejects.toThrow(
      /examination cell/i
    );
  });

  /**
   * A student who does not exist is a 404, not a 403 — the record is not
   * there at all.
   */
  it('reports a student who does not exist as missing', async () => {
    const service = await buildService(['students:read']);

    await expect(service.buildProfile('student-999', 'caller-1')).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});
