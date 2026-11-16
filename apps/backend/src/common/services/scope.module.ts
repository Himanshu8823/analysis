import { Global, Module } from '@nestjs/common';
import { lookup } from 'dns/promises';
import { ScopeService } from './scope.service';
import { AuthorisationService } from './authorisation.service';
import { HostResolver, URL_RESOLVER, UrlGuardService } from './url-guard.service';
import { RbacModule } from '@/modules/rbac/rbac.module';

/**
 * Global scope module.
 *
 * `@Global()` because the branch scope is cross-cutting: every module that
 * serves a read (students, marks, analytics, toppers, reports) has to apply
 * the same rule, and threading an import through each of them would be noise.
 *
 * The {@link AuthorisationService} lives here for the same reason: it is the
 * one place that answers "may this member do this, and over which records",
 * and every module that writes needs it.
 *
 * The {@link UrlGuardService} is here for the same reason as well: every
 * module that fetches a file the user named needs the same rule about
 * which addresses may be visited, and that rule must not be restated once
 * per module.
 */
@Global()
@Module({
  imports: [RbacModule],
  providers: [
    ScopeService,
    AuthorisationService,
    UrlGuardService,
    /**
     * The system's own resolver, registered under the token the guard asks
     * for. Registering it here rather than relying on the guard's fallback
     * means the dependency is visible in the module graph: a reader can see
     * where the resolver comes from, and the tests can replace it by
     * overriding the token.
     */
    {
      provide: URL_RESOLVER,
      useValue: ((hostname: string) => lookup(hostname, { all: true })) satisfies HostResolver,
    },
  ],
  exports: [ScopeService, AuthorisationService, UrlGuardService],
})
export class ScopeModule {}
