import { BadRequestException, Injectable } from '@nestjs/common';
import type { TopperAlgorithm } from './base.algorithm';
import { CreditsAlgorithm } from './credits.algorithm';
import { MarksAlgorithm } from './marks.algorithm';
import { PercentageAlgorithm } from './percentage.algorithm';

export type RankingRule = 'percentage' | 'credits' | 'marks';

/**
 * Resolves the TopperAlgorithm that should be used based on the chosen rule.
 * New strategies can be added by appending to the registry.
 */
@Injectable()
export class TopperStrategyFactory {
  private readonly registry: Map<RankingRule, TopperAlgorithm>;

  constructor() {
    this.registry = new Map<RankingRule, TopperAlgorithm>();
    this.registry.set('percentage', new PercentageAlgorithm());
    this.registry.set('credits', new CreditsAlgorithm());
    this.registry.set('marks', new MarksAlgorithm());
  }

  get(rule: string): TopperAlgorithm {
    const key = rule.toLowerCase() as RankingRule;
    const algo = this.registry.get(key);
    if (!algo) {
      throw new BadRequestException(
        `Unknown ranking rule: ${rule}. Use one of: ${[...this.registry.keys()].join(', ')}`,
      );
    }
    return algo;
  }

  listSupported(): string[] {
    return [...this.registry.keys()];
  }
}
