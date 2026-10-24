import 'dotenv/config';
import { Worker, Queue } from 'bullmq';
import IORedis from 'ioredis';

/**
 * BullMQ worker process.
 *
 * Long-running jobs (report generation, OCR) are queued by the backend and
 * processed here. Registered queue names must match those used by
 * `apps/backend` when it enqueues jobs.
 */

const REDIS_HOST = process.env.REDIS_HOST ?? 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT ?? '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

const redisConnection = new IORedis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
});

/** Queue names this worker consumes. Keep in sync with the backend enqueue calls. */
export const WORKER_QUEUES = ['reports', 'ocr'] as const;

type QueueName = (typeof WORKER_QUEUES)[number];

const workers: Worker[] = [];

/**
 * Placeholder handler for a queue.
 *
 * The real processor for each queue is implemented alongside the backend module
 * that enqueues it. Until then the job is acknowledged so the queue does not
 * back up with jobs that will never succeed.
 */
function createHandler(queueName: QueueName) {
  return async (job: { id: string | number; name: string; data: unknown }) => {
    // eslint-disable-next-line no-console
    console.log(`[worker:${queueName}] processing job ${job.id} (${job.name})`);
    return { status: 'completed', queue: queueName, jobId: job.id };
  };
}

async function bootstrap(): Promise<void> {
  for (const queueName of WORKER_QUEUES) {
    const worker = new Worker(queueName, createHandler(queueName), {
      connection: redisConnection,
      concurrency: 5,
    });

    worker.on('completed', (job) => {
      // eslint-disable-next-line no-console
      console.log(`[worker:${queueName}] job ${job.id} completed`);
    });

    worker.on('failed', (job, err) => {
      // eslint-disable-next-line no-console
      console.error(`[worker:${queueName}] job ${job?.id} failed:`, err.message);
    });

    workers.push(worker);
  }

  // eslint-disable-next-line no-console
  console.log(`Worker is running. Consuming queues: ${WORKER_QUEUES.join(', ')}`);
}

async function shutdown(signal: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`\nReceived ${signal}, shutting down worker...`);
  await Promise.all(workers.map((worker) => worker.close()));
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
