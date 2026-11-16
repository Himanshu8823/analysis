import type { Queue } from 'bullmq';

/**
 * The state of one queue, as the supervisor sees it.
 */
export interface QueueStatus {
  name: string;
  /** Jobs waiting to be picked up. */
  waiting: number;
  /** Jobs currently being processed. */
  active: number;
  /** Jobs scheduled for later. */
  delayed: number;
  /** Jobs that failed and are waiting to be retried or have been given up on. */
  failed: number;
  /** Jobs that completed. */
  completed: number;
  /** The oldest waiting job's age in milliseconds, or `null` when none waits. */
  oldestWaitingAgeMs: number | null;
  /** The most recent failures, newest first. */
  recentFailures: Array<{ id: string; name: string; reason: string }>;
}

/**
 * The subset of BullMQ's `Queue` the supervisor uses.
 *
 * Declared here rather than depending on the whole class so the reading
 * logic can be tested without a live Redis.
 */
export interface QueueReader {
  readonly name: string;
  getJobCounts(...states: string[]): Promise<Record<string, number>>;
  getWaiting(start: number, end: number): Promise<Array<{ id?: string; timestamp: number }>>;
  getFailed(start: number, end: number): Promise<
    Array<{ id?: string; name: string; failedReason?: string | null }>
  >;
}

/**
 * Reads the state of a queue.
 *
 * Nothing is removed, retried or acknowledged — the supervisor observes.
 */
export async function readQueueStatus(
  queue: QueueReader,
  now: number = Date.now()
): Promise<QueueStatus> {
  const counts = await queue.getJobCounts(
    'waiting',
    'active',
    'delayed',
    'failed',
    'completed'
  );

  /**
   * The oldest waiting job is the one that has been queuing longest, and it
   * is the one an operator wants to know about. BullMQ's `waiting` list is
   * ordered oldest-first, so the first entry is that job.
   */
  const oldest = await queue.getWaiting(0, 0);
  const oldestJob = oldest[0];
  const oldestWaitingAgeMs = oldestJob ? now - oldestJob.timestamp : null;

  const failed = await queue.getFailed(0, 9);
  const recentFailures = failed.map((job) => ({
    id: job.id ?? 'unknown',
    name: job.name,
    reason: job.failedReason || 'No reason was recorded.',
  }));

  return {
    name: queue.name,
    waiting: counts.waiting ?? 0,
    active: counts.active ?? 0,
    delayed: counts.delayed ?? 0,
    failed: counts.failed ?? 0,
    completed: counts.completed ?? 0,
    oldestWaitingAgeMs,
    recentFailures,
  };
}

/**
 * A short, readable line for one queue.
 */
export function describeQueueStatus(status: QueueStatus): string {
  const parts = [
    `${status.waiting} waiting`,
    `${status.active} active`,
    `${status.failed} failed`,
  ];

  if (status.oldestWaitingAgeMs !== null) {
    const seconds = Math.round(status.oldestWaitingAgeMs / 1000);
    parts.push(`oldest waiting ${seconds}s`);
  }

  const line = `[queue:${status.name}] ${parts.join(', ')}`;
  if (status.recentFailures.length === 0) return line;

  const failures = status.recentFailures
    .map((failure) => `  - ${failure.name} #${failure.id}: ${failure.reason}`)
    .join('\n');
  return `${line}\n${failures}`;
}

/**
 * A BullMQ `Queue` satisfies the reader interface.
 *
 * The cast is here rather than at every call site so the rest of the module
 * depends only on the narrow interface.
 */
export function asQueueReader(queue: Queue): QueueReader {
  return queue as unknown as QueueReader;
}
