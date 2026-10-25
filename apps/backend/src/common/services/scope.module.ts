import { Global, Module } from '@nestjs/common';
import { ScopeService } from './scope.service';

/**
 * Global scope module.
 *
 * `@Global()` because the branch scope is cross-cutting: every module that
 * serves a read (students, marks, analytics, toppers, reports) has to apply
 * the same rule, and threading an import through each of them would be noise.
 */
@Global()
@Module({
  providers: [ScopeService],
  exports: [ScopeService],
})
export class ScopeModule {}
