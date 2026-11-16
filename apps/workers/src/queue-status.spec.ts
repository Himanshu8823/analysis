import { readQueueStatus, describeQueueStatus } from './queue-status';
import type { QueueReader, QueueStatus } from './queue-status';

/**
 * A stand-in for a BullMQ queue.
 *
 * Only the three reads the supervisor performs are implemented — which is the
 * point: the supervisor must not be able to remove or acknowledge anything,
 * so its dependency surface cannot grow one by accident.
 */
function fakeQueue(overrides: Partial<QueueReader> & { name: string }): QueueReader {
  return {
    getJobCounts: async () => ({}),
    getWaiting: async () => [],
    getFailed: async () => [],
    ...overrides,
  };
}

describe('readQueueStatus', () => {
  it('reports the counts of every state it asked for', async () => {
    const queue = fakeQueue({
      name: 'upload-jobs',
      getJobCounts: async () => ({
        waiting: 3,
        active: 1,
        delayed: 2,
        failed: 4,
        completed: 17,
      }),
    });

    const status = await readQueueStatus(queue);

    expect(status).toMatchObject({
      name: 'upload-jobs',
      waiting: 3,
      active: 1,
      delayed: 2,
      failed: 4,
      completed: 17,
    });
  });

  it('treats a count the queue did not report as zero', async () => {
    const queue = fakeQueue({
      name: 'ocr-jobs',
      getJobCounts: async () => ({ waiting: 2 }),
    });

    const status = await readQueueStatus(queue);

    expect(status.active).toBe(0);
    expect(status.delayed).toBe(0);
    expect(status.failed).toBe(0);
    expect(status.completed).toBe(0);
  });

  it('reports the age of the oldest waiting job', async () => {
    const now = 1_700_000_000_000;
    const queue = fakeQueue({
      name: 'upload-jobs',
      getWaiting: async () => [{ id: 'job-1', timestamp: now - 45_000 }],
    });

    const status = await readQueueStatus(queue, now);

    expect(status.oldestWaitingAgeMs).toBe(45_000);
  });

  it('reports no age when nothing is waiting', async () => {
    const queue = fakeQueue({
      name: 'upload-jobs',
      getWaiting: async () => [],
    });

    const status = await readQueueStatus(queue);

    expect(status.oldestWaitingAgeMs).toBeNull();
  });

  it('lists the failures with their reason', async () => {
    const queue = fakeQueue({
      name: 'reports-jobs',
      getFailed: async () => [
        { id: 'job-9', name: 'generate', failedReason: 'Out of memory' },
        { id: 'job-8', name: 'generate', failedReason: null },
      ],
    });

    const status = await readQueueStatus(queue);

    expect(status.recentFailures).toEqual([
      { id: 'job-9', name: 'generate', reason: 'Out of memory' },
      { id: 'job-8', name: 'generate', reason: 'No reason was recorded.' },
    ]);
  });

  it('names a failure whose id is missing rather than dropping it', async () => {
    const queue = fakeQueue({
      name: 'reports-jobs',
      getFailed: async () => [{ name: 'generate', failedReason: 'Boom' }],
    });

    const status = await readQueueStatus(queue);

    expect(status.recentFailures[0].id).toBe('unknown');
  });
});

describe('describeQueueStatus', () => {
  const base: QueueStatus = {
    name: 'upload-jobs',
    waiting: 2,
    active: 1,
    delayed: 0,
    failed: 0,
    completed: 9,
    oldestWaitingAgeMs: null,
    recentFailures: [],
  };

  it('names the queue and its counts', () => {
    const line = describeQueueStatus(base);

    expect(line).toContain('[queue:upload-jobs]');
    expect(line).toContain('2 waiting');
    expect(line).toContain('1 active');
    expect(line).toContain('0 failed');
  });

  it('omits the waiting age when nothing waits', () => {
    expect(describeQueueStatus(base)).not.toContain('oldest waiting');
  });

  it('reports the waiting age in seconds', () => {
    const line = describeQueueStatus({ ...base, oldestWaitingAgeMs: 125_000 });

    expect(line).toContain('oldest waiting 125s');
  });

  it('lists each failure under the queue line', () => {
    const line = describeQueueStatus({
      ...base,
      recentFailures: [{ id: 'job-9', name: 'generate', reason: 'Out of memory' }],
    });

    expect(line).toContain('- generate #job-9: Out of memory');
  });
});
