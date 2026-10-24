import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

import databaseConfig from './config/database.config';
import authConfig from './config/auth.config';
import redisConfig from './config/redis.config';
import storageConfig from './config/storage.config';
import emailConfig from './config/email.config';

import { PrismaModule } from './database/prisma.module';

import { CacheModule } from './modules/cache/cache.module';
import { StorageModule } from './modules/storage/storage.module';
import { EmailModule } from './modules/email/email.module';
import { InvitesModule } from './modules/invites/invites.module';
import { PasswordResetModule } from './modules/password-reset/password-reset.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { BranchesModule } from './modules/branches/branches.module';
import { AcademicModule } from './modules/academic/academic.module';
import { SchemesModule } from './modules/schemes/schemes.module';
import { SubjectsModule } from './modules/subjects/subjects.module';
import { StudentsModule } from './modules/students/students.module';
import { MarksModule } from './modules/marks/marks.module';
import { UploadModule } from './modules/upload/upload.module';
import { PdfParserModule } from './modules/pdf-parser/pdf-parser.module';
import { OcrModule } from './modules/ocr/ocr.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ToppersModule } from './modules/toppers/toppers.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { HealthModule } from './modules/health/health.module';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { ForcePasswordChangeGuard } from './common/guards/force-password-change.guard';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, authConfig, redisConfig, storageConfig, emailConfig],
      validate: (config: Record<string, unknown>) => config,
    }),

    // Rate limiting (real-world patterns from PROJECT.md section 11)
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 3 }, // 3 req/sec
      { name: 'medium', ttl: 60000, limit: 100 }, // 100 req/min
      { name: 'long', ttl: 3600000, limit: 1000 }, // 1000 req/hr
    ]),

    // BullMQ for queues
    BullModule.forRootAsync({
      useFactory: () => ({
        // The same Redis instance the cache uses. Reading the values from the
        // environment here (rather than from `redisConfig`) keeps the queue
        // and the cache pointed at the same database — `REDIS_DB` included.
        connection: {
          host: process.env.REDIS_HOST ?? 'localhost',
          port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
          password: process.env.REDIS_PASSWORD,
          db: parseInt(process.env.REDIS_DB ?? '0', 10),
        },
      }),
    }),

    // Database
    PrismaModule,

    // Cache (global — consumed by the guards and the auth/RBAC services)
    CacheModule,

    // Storage (global — consumed by the upload module)
    StorageModule,

    // Feature modules (sorted by dependency order)
    EmailModule,
    InvitesModule,
    PasswordResetModule,
    AuthModule,
    UsersModule,
    RbacModule,
    BranchesModule,
    AcademicModule,
    SchemesModule,
    SubjectsModule,
    StudentsModule,
    MarksModule,
    UploadModule,
    PdfParserModule,
    OcrModule,
    ReportsModule,
    ToppersModule,
    AnalyticsModule,
    DashboardModule,
    AuditLogsModule,
    NotificationsModule,
    HealthModule,
  ],
  providers: [
    // Global rate limit guard (with custom limits per-route via decorators)
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Global auth guard (routes marked @Public skip it)
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Blocks every route while a password change is still pending
    { provide: APP_GUARD, useClass: ForcePasswordChangeGuard },
    // RBAC guards
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}