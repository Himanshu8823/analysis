/**
 * The tests for the reports screen's scope.
 *
 * The reports screen is where a leak hurts most: a report is a published
 * statement about a class — every student in it gets a PASS or a FAIL on the
 * sheet — so a report that reaches the wrong person is not a small mistake.
 *
 * The faults these tests guard against were all of one kind: a read that
 * answered "no filter" where it should have answered "these branches".
 * The single-id resolver does exactly that when a member holds several
 * branches and names none, which is the ordinary case on the screen — the
 * list opens on "everything I can see".
 *
 * They also guard the delete: a report that may not be read may not be
 * deleted, or the scope on the read is theatre.
 */

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import type { ReportsService } from './reports.service';
import type { ScopeService } from '@/common/services/scope.service';
import type { JwtPayload } from '@/common/types';

/**
 * A caller.
 */
const CALLER = { sub: 'user-1', role: 'TEACHER' } as JwtPayload;

/**
 * A controller wired to a scope and a service that only record what they
 * were asked.
 */
function buildController(options: {
  scope: Partial<ScopeService>;
  service?: Partial<ReportsService>;
}) {
  const service = {
    findAll: jest.fn().mockResolvedValue({ items: [], meta: { total: 0 } }),
    findById: jest.fn().mockResolvedValue({ id: 'report-1' }),
    findBranchIdOfReport: jest.fn().mockResolvedValue('branch-a'),
    checkReadiness: jest.fn().mockResolvedValue({ isReady: true, message: '' }),
    delete: jest.fn().mockResolvedValue(undefined),
    archive: jest.fn().mockResolvedValue(undefined),
    create: jest.fn().mockResolvedValue({ id: 'report-1' }),
    ...options.service,
  };

  const scope = {
    resolveBranchFilter: jest.fn().mockResolvedValue(undefined),
    resolveBranchScope: jest.fn().mockResolvedValue(undefined),
    ...options.scope,
  };

  const controller = new ReportsController(service as never, scope as never);

  return { controller, service, scope };
}

describe('the reports screen', () => {
  describe('listing reports', () => {
    it('narrows the list to the branches the caller holds', async () => {
      const { controller, service, scope } = buildController({
        scope: { resolveBranchFilter: jest.fn().mockResolvedValue(['branch-a', 'branch-b']) },
      });

      await controller.findAll(CALLER);

      expect(scope.resolveBranchFilter).toHaveBeenCalledWith('user-1', undefined);
      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ branchId: ['branch-a', 'branch-b'] })
      );
    });

    it('passes the branch the caller named through to the filter', async () => {
      const { controller, service } = buildController({
        scope: { resolveBranchFilter: jest.fn().mockResolvedValue(['branch-b']) },
      });

      await controller.findAll(
        CALLER,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'branch-b'
      );

      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ branchId: ['branch-b'] })
      );
    });

    it('applies no filter for a college-wide caller', async () => {
      const { controller, service } = buildController({
        scope: { resolveBranchFilter: jest.fn().mockResolvedValue(undefined) },
      });

      await controller.findAll(CALLER);

      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ branchId: undefined })
      );
    });

    it('refuses the read when the caller names a branch they do not hold', async () => {
      const { controller } = buildController({
        scope: {
          resolveBranchFilter: jest.fn().mockRejectedValue(new ForbiddenException('nope')),
        },
      });

      await expect(controller.findAll(CALLER)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('checking whether a class is ready to report on', () => {
    it('checks the class the caller named', async () => {
      const { controller, service } = buildController({
        scope: { resolveBranchFilter: jest.fn().mockResolvedValue(['branch-a']) },
      });

      await controller.readiness(CALLER, 'branch-a', 'scheme-1', '4', 'year-1');

      expect(service.checkReadiness).toHaveBeenCalledWith({
        branchId: 'branch-a',
        schemeId: 'scheme-1',
        semester: 4,
        academicYearId: 'year-1',
      });
    });

    it('asks a caller who holds several branches to name one', async () => {
      const { controller, service } = buildController({
        scope: { resolveBranchFilter: jest.fn().mockResolvedValue(['branch-a', 'branch-b']) },
      });

      await expect(
        controller.readiness(CALLER, undefined, 'scheme-1', '4', 'year-1')
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(service.checkReadiness).not.toHaveBeenCalled();
    });

    it('asks a college-wide caller to name a branch', async () => {
      const { controller, service } = buildController({
        scope: { resolveBranchFilter: jest.fn().mockResolvedValue(undefined) },
      });

      await expect(
        controller.readiness(CALLER, undefined, 'scheme-1', '4', 'year-1')
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(service.checkReadiness).not.toHaveBeenCalled();
    });

    it("uses the caller's own branch when they name none and hold only one", async () => {
      const { controller, service } = buildController({
        scope: { resolveBranchFilter: jest.fn().mockResolvedValue(['branch-a']) },
      });

      await controller.readiness(CALLER, undefined, 'scheme-1', '4', 'year-1');

      expect(service.checkReadiness).toHaveBeenCalledWith(
        expect.objectContaining({ branchId: 'branch-a' })
      );
    });
  });

  describe('reading one report', () => {
    it('refuses a report belonging to a branch the caller does not hold', async () => {
      const { controller } = buildController({
        scope: {
          resolveBranchFilter: jest.fn().mockRejectedValue(new ForbiddenException('nope')),
        },
      });

      await expect(controller.findById(CALLER, 'report-1')).rejects.toBeInstanceOf(
        ForbiddenException
      );
    });

    it('allows a report the caller holds', async () => {
      const { controller, service } = buildController({
        scope: { resolveBranchFilter: jest.fn().mockResolvedValue(['branch-a']) },
      });

      await controller.findById(CALLER, 'report-1');

      expect(service.findById).toHaveBeenCalledWith('report-1');
    });

    it('allows a report that names no branch, because it covers the whole college', async () => {
      const { controller, service } = buildController({
        scope: { resolveBranchFilter: jest.fn().mockResolvedValue(['branch-a']) },
        service: { findBranchIdOfReport: jest.fn().mockResolvedValue(null) },
      });

      await controller.findById(CALLER, 'report-1');

      expect(service.findById).toHaveBeenCalledWith('report-1');
    });
  });

  describe('archiving a report', () => {
    it('refuses to archive a report belonging to a branch the caller does not hold', async () => {
      const { controller, service } = buildController({
        scope: {
          resolveBranchFilter: jest.fn().mockRejectedValue(new ForbiddenException('nope')),
        },
      });

      await expect(
        controller.delete(CALLER, 'report-1', { reason: 'Generated for the wrong semester.' })
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(service.archive).not.toHaveBeenCalled();
    });

    it('archives a report the caller holds, with the reason they gave', async () => {
      const { controller, service } = buildController({
        scope: { resolveBranchFilter: jest.fn().mockResolvedValue(['branch-a']) },
      });

      const reason = 'Generated for the wrong semester.';
      await controller.delete(CALLER, 'report-1', { reason });

      expect(service.archive).toHaveBeenCalledWith('report-1', 'user-1', reason);
    });
  });
});
