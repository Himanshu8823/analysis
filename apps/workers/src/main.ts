import 'dotenv/config';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { readQueueStatus, describeQueueStatus, asQueueReader } from './queue-status';

/**
 * The queue supervisor.
 *
 * The backend process runs the processors for every queue — `upload-jobs`,
 * `ocr-jobs`, `reports-jobs` and `email-jobs` — because each processor needs
 * the backend's own services (the upload parser needs `StorageService`, the
 * report writer needs Prisma). This process therefore does **not** consume
 * those queues: a second consumer that acknowledges a job it did not perform
 * turns a visible failure into invisible data loss.
 *
 * What it does instead is answer the question an operator actually has when
 * results are not appearing: *is the queue backing up, and is the job that
 * matters stuck?*
 *
 * It reports, for each queue:
 *
 *  - how many jobs are waiting, active, delayed or failed,
 *  - how long the oldest waiting job has been waiting,
 *  - the jobs that have failed, with their error message.
 *
 * See `docs/DECISIONS.md` §8 for why the queue is supervised rather than
 * consumed twice.
 */

/**
 * The queues this process watches.
 *
 * These must match the names the backend enqueues under, or the supervisor
 * watches a queue that never receives anything.
 */
export const WORKER_QUEUES = ['upload-jobs', 'ocr-jobs', 'reports-jobs', 'email-jobs'] as const;

export type QueueName = (typeof WORKER_QUEUES)[number];

/** How often the queues are reported. */
const REPORT_INTERVAL_MS = Number(process.env.WORKER_REPORT_INTERVAL_MS ?? 60_000);

const REDIS_HOST = process.env.REDIS_HOST ?? 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT ?? '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

const redisConnection = new IORedis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
});

/**
 * The queues this process watches.
 *
 * BullMQ's `Queue` is used in read-only fashion here: the supervisor counts
 * jobs and reads their state, and never removes, retries or acknowledges
 * anything.
 */
const queues: Queue[] = WORKER_QUEUES.map(
  (name) =>
    new Queue(name, {
      connection: redisConnection,
    })
);

let reportTimer: NodeJS.Timeout | null = null;

/**
 * Reports the state of every queue.
 *
 * A failure to reach Redis is reported rather than thrown: the supervisor
 * is a read-only observer, and crashing it would take away the very thing it
 * is for.
 */
async function report(): Promise<void> {
  for (const queue of queues) {
    try {
      const status = await readQueueStatus(asQueueReader(queue));
      // eslint-disable-next-line no-console
      console.log(describeQueueStatus(status));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      // eslint-disable-next-line no-console
      console.error(`[queue:${queue.name}] could not be read: ${message}`);
    }
  }
}

async function bootstrap(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(
    `Queue supervisor is running. Watching: ${WORKER_QUEUES.join(', ')}. ` +
      'Jobs are processed by the backend, not by this process.'
  );

  await report();
  reportTimer = setInterval(() => {
    void report();
  }, REPORT_INTERVAL_MS);
}

async function shutdown(signal: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`\nReceived ${signal}, shutting down queue supervisor...`);
  if (reportTimer) clearInterval(reportTimer);
  await Promise.all(queues.map((queue) => queue.close()));
  await redisConnection.quit();
  process.exit(0);
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

void bootstrap();
