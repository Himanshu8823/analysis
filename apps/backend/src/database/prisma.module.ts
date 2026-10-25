import { Global, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

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

@Global()
@Module({
  providers: [
    {
      provide: PrismaClient,
      useFactory: () =>
        new PrismaClient({
          log:
            process.env.NODE_ENV === 'development'
              ? ['query', 'info', 'warn', 'error']
              : ['warn', 'error'],
          datasources: {
            db: { url: withPoolSettings(process.env.DATABASE_URL) },
          },
        }),
    },
  ],
  exports: [PrismaClient],
})
export class PrismaModule implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly prisma: PrismaClient) {}

  async onModuleInit(): Promise<void> {
    await this.prisma.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
