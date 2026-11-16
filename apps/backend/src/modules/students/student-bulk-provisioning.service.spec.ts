/**
 * The tests for the bulk login-provisioning selection logic.
 *
 * ## What is being tested
 *
 * The bulk run has to answer three questions correctly, and each of them
 * has a failure mode that is silent:
 *
 *  1. **Which students does the run cover?** A class scope finds the
 *     class's students; an explicit list is taken as given. Accepting both
 *     at once would leave the clerk guessing which instruction the system
 *     took, so the run refuses.
 *  2. **May the caller provision them?** The right to run a bulk
 *     provisioning is its own permission, checked in the service layer.
 *  3. **What happens when one student fails?** The run must not fail
 *     because one of a hundred records has no address — the other
 *     ninety-nine accounts were created and the clerk has to be told
 *     about them.
 *
 * The tests below cover all three, plus the branch scope: a run must not
 * quietly skip the students outside the caller's branch, because a run
 * that reports a success which did not cover what was asked for is worse
 * than a refusal.
 */

import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import { StudentBulkProvisioningService } from './student-bulk-provisioning.service';
import { StudentProvisioningService } from './student-provisioning.service';
import { AuthorisationService } from '@/common/services/authorisation.service';
import { AuditService } from '@/common/services/audit.service';

/**
 * A student record, as the repository returns it.
 */
function aStudent(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'student-1',
    rollNo: 'CS2022-001',
    name: 'Aarav Sharma',
    email: 'aarav@example.com',
    branchId: 'branch-1',
    ...overrides,
  };
}

/**
 * Builds the service with the given stubs.
 */
async function buildService(options: {
  permissions?: string[];
  students?: Array<ReturnType<typeof aStudent>>;
  assertBranchWritable?: jest.Mock;
  provision?: jest.Mock;
}) {
  const prisma = {
    student: {
      findMany: jest.fn(async () => options.students ?? []),
    },
  };

  const authorisation = {
    assertAnyPermission: jest.fn(async () => undefined),
    permissionsOf: jest.fn(async () => options.permissions ?? []),
    assertBranchWritable: options.assertBranchWritable ?? jest.fn(async () => undefined),
  };

  const provisioning = {
    provision:
      options.provision ??
      jest.fn(async (studentId: string) => ({
        studentId,
        studentName: 'Aarav Sharma',
        rollNo: 'CS2022-001',
        email: 'aarav@example.com',
        userId: 'user-1',
        created: true,
        temporaryPassword: 'TempPassword123',
      })),
  };

  const auditService = {
    record: jest.fn(async () => undefined),
  };

  const module = await Test.createTestingModule({
    providers: [
      StudentBulkProvisioningService,
      { provide: PrismaClient, useValue: prisma },
      { provide: StudentProvisioningService, useValue: provisioning },
      { provide: AuthorisationService, useValue: authorisation },
      { provide: AuditService, useValue: auditService },
    ],
  }).compile();

  return {
    service: module.get(StudentBulkProvisioningService),
    prisma,
    authorisation,
    provisioning,
    auditService,
  };
}

describe('choosing who a bulk run covers', () => {
  it('refuses a run that names both a class and a list of students', async () => {
    const { service } = await buildService({});

    await expect(
      service.provision(
        { branchId: 'branch-1', semester: 1, schemeId: 'scheme-1', studentIds: ['s1'] },
        'caller-1'
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses a run that names neither a class nor a list of students', async () => {
    const { service } = await buildService({});

    await expect(service.provision({}, 'caller-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses a class that has no students', async () => {
    const { service } = await buildService({ students: [] });

    await expect(
      service.provision({ branchId: 'branch-1', semester: 1, schemeId: 'scheme-1' }, 'caller-1')
    ).rejects.toThrow(/no students/i);
  });

  it('takes an explicit list of students as given', async () => {
    const { service, prisma } = await buildService({
      students: [aStudent(), aStudent({ id: 'student-2', rollNo: 'CS2022-002' })],
    });

    const result = await service.provision({ studentIds: ['student-1', 'student-2'] }, 'caller-1');

    expect(result.created).toBe(2);
    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ['student-1', 'student-2'] } }),
      })
    );
  });
});

describe('the right to run a bulk provisioning', () => {
  it('is refused when the caller does not hold it', async () => {
    const { service, authorisation, provisioning } = await buildService({
      students: [aStudent()],
    });

    /**
     * The permission check is what refuses the run. The stub raises the
     * same refusal the real service raises, so the test proves the run
     * *calls* the check rather than that the check itself works — the
     * check is the authorisation service's own, tested there.
     */
    (authorisation.assertAnyPermission as unknown as jest.Mock).mockRejectedValueOnce(
      new ForbiddenException('You do not have access to this.')
    );

    await expect(
      service.provision({ studentIds: ['student-1'] }, 'caller-1')
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(provisioning.provision).not.toHaveBeenCalled();
  });

  it('is checked in the service layer, not only in the controller', async () => {
    const { service, authorisation } = await buildService({ students: [aStudent()] });

    await service.provision({ studentIds: ['student-1'] }, 'caller-1');

    expect(authorisation.assertAnyPermission).toHaveBeenCalledWith('caller-1', [
      'students:bulk_provision',
    ]);
  });
});

describe('the outcome of a bulk run', () => {
  it('reports a created account and a linked account separately', async () => {
    const provision = jest
      .fn()
      .mockResolvedValueOnce({
        studentId: 'student-1',
        studentName: 'Aarav Sharma',
        rollNo: 'CS2022-001',
        email: 'aarav@example.com',
        userId: 'user-1',
        created: true,
        temporaryPassword: 'TempPassword123',
      })
      .mockResolvedValueOnce({
        studentId: 'student-2',
        studentName: 'Bina Patil',
        rollNo: 'CS2022-002',
        email: 'bina@example.com',
        userId: 'user-2',
        created: false,
        temporaryPassword: null,
      });

    const { service } = await buildService({
      students: [
        aStudent(),
        aStudent({ id: 'student-2', rollNo: 'CS2022-002', name: 'Bina Patil' }),
      ],
      provision,
    });

    const result = await service.provision({ studentIds: ['student-1', 'student-2'] }, 'caller-1');

    expect(result.created).toBe(1);
    expect(result.linked).toBe(1);
    expect(result.accounts).toHaveLength(2);
    expect(result.accounts[0].temporaryPassword).toBe('TempPassword123');
    expect(result.accounts[1].temporaryPassword).toBeNull();
  });

  it('keeps going when one student fails, and names the one that did', async () => {
    const provision = jest
      .fn()
      .mockRejectedValueOnce(new Error('That email address is already in use.'))
      .mockResolvedValueOnce({
        studentId: 'student-2',
        studentName: 'Bina Patil',
        rollNo: 'CS2022-002',
        email: 'bina@example.com',
        userId: 'user-2',
        created: true,
        temporaryPassword: 'TempPassword456',
      });

    const { service } = await buildService({
      students: [
        aStudent(),
        aStudent({ id: 'student-2', rollNo: 'CS2022-002', name: 'Bina Patil' }),
      ],
      provision,
    });

    const result = await service.provision({ studentIds: ['student-1', 'student-2'] }, 'caller-1');

    expect(result.created).toBe(1);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].rollNo).toBe('CS2022-001');
    expect(result.failures[0].reason).toContain('already in use');
  });

  it('skips a student with no email address when the clerk asks it to', async () => {
    const { service, provisioning } = await buildService({
      students: [aStudent({ email: null })],
    });

    const result = await service.provision(
      { studentIds: ['student-1'], skipMissingEmail: true },
      'caller-1'
    );

    expect(result.skipped).toBe(1);
    expect(result.created).toBe(0);
    expect(provisioning.provision).not.toHaveBeenCalled();
  });

  it('fails the student with no email address when the clerk does not ask it to skip', async () => {
    const { service } = await buildService({
      students: [aStudent({ email: null })],
    });

    const result = await service.provision({ studentIds: ['student-1'] }, 'caller-1');

    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].reason).toContain('no email address');
  });
});

describe('the scope of a bulk run', () => {
  it('refuses the whole run when a student is outside the caller’s branch', async () => {
    const assertBranchWritable = jest.fn(async () => {
      throw new ForbiddenException(
        'This student belongs to another branch, so you cannot change it.'
      );
    });

    const { service, provisioning } = await buildService({
      students: [aStudent({ branchId: 'branch-2' })],
      assertBranchWritable,
    });

    await expect(
      service.provision({ studentIds: ['student-1'] }, 'caller-1')
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(provisioning.provision).not.toHaveBeenCalled();
  });

  it('records the run in the audit trail', async () => {
    const { service, auditService } = await buildService({ students: [aStudent()] });

    await service.provision({ studentIds: ['student-1'] }, 'caller-1');

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'caller-1',
        details: expect.objectContaining({
          event: 'STUDENT_BULK_PROVISIONED',
          requested: 1,
          created: 1,
        }),
      })
    );
  });
});
