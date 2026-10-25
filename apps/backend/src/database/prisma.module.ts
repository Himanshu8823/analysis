import { Global, Logger, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Adds the pool settings the serverless Postgres provider needs.
 *
 * Prisma sizes its pool from the CPU count, which on a small container opens
 * more connections than the provider allows. The surplus connections are
 * closed by the provider, and the next request fails with "Can't reach
 * database server" until the pool refills — an intermittent error right
 * after a cold start.
 *
 * `connection_limit` caps the pool and `pool_timeout` bounds how long a
 * request waits for a free connection instead of failing outright. Both
 * are query parameters on the connection URL, so the existing `sslmode`
 * and `channel_binding` settings are preserved.
 */
function withPoolSettings(url: string | undefined): string | undefined {
  if (!url) return url;

  const params = new URLSearchParams(url.split('?')[1] ?? '');
  if (!params.has('connection_limit')) {
    params.set('connection_limit', '10');
  }
  if (!params.has('pool_timeout')) {
    params.set('pool_timeout', '20');
  }

  const query = params.toString();
  const base = url.split('?')[0];
  return query ? `${base}?${query}` : base;
}

/**
 * Errors that are safe to retry.
 *
 * All of them mean the statement never reached the database:
 *
 *  - `P1001` — the server could not be reached at all;
 *  - `P1002` — the server was reached but the connection timed out;
 *  - `P1008` — a connection attempt timed out;
 *  - `P2024` — the Prisma pool had no free connection in time.
 *
 * `P1017` ("server has closed the connection") is deliberately absent: the
 * statement may already have been executed, and retrying a write would
 * duplicate it.
 */
const RETRYABLE_CODES = new Set(['P1001', 'P1002', 'P1008', 'P2024']);

const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 500;

/** Recognises a transient connectivity failure. */
function isRetryable(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return RETRYABLE_CODES.has(error.code);
  }
  // Prisma reports a cold-start failure raised outside its request pipeline
  // (the initial connection handshake) as a plain error carrying this text.
  return error instanceof Error && error.message.includes("Can't reach database server");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs a database operation, retrying transient connectivity failures with
 * exponential backoff.
 *
 * The backend talks to a serverless Postgres provider that suspends after a
 * period of inactivity. The first request after a suspend pays the wake-up
 * cost, and a pool connection opened during that window can be refused. The
 * client sees `P1001` even though the database is healthy a moment later, so
 * the request is retried instead of surfacing a 500.
 */
async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  let attempt = 0;

  for (;;) {
    try {
      return await operation();
    } catch (error) {
      attempt += 1;
      if (attempt >= MAX_ATTEMPTS || !isRetryable(error)) throw error;
      await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
    }
  }
}

/**
 * Wraps every Prisma operation in the retry helper.
 *
 * Prisma's query extensions are the one layer that sees *all* model calls, so
 * this covers the dashboard, the mark entry routes and everything else
 * without each service having to know about the provider's wake-up window.
 */
function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['warn', 'error'],
    datasources: {
      db: { url: withPoolSettings(process.env.DATABASE_URL) },
    },
  });

  const extended = client.$extends({
    query: {
      $allOperations({ args, query }) {
        return withRetry(() => query(args));
      },
    },
  });

  // `$extends` returns a structurally compatible client with extra model
  // properties; the rest of the app receives the standard `PrismaClient`.
  return extended as unknown as PrismaClient;
}

@Global()
@Module({
  providers: [
    {
      provide: PrismaClient,
      useFactory: createPrismaClient,
    },
  ],
  exports: [PrismaClient],
})
export class PrismaModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaModule.name);

  constructor(private readonly prisma: PrismaClient) {}

  async onModuleInit(): Promise<void> {
    // A cold provider rejects the very first connection; retrying here means
    // the application boots instead of failing its module initialisation.
    await withRetry(() => this.prisma.$connect()).catch((error: unknown) => {
      this.logger.error(`Database connection failed on startup: ${(error as Error).message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
