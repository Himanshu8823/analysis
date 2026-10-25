import { BadRequestException, Injectable } from '@nestjs/common';
import type { TopperAlgorithm } from './base.algorithm';
import { CreditsAlgorithm } from './credits.algorithm';
import { MarksAlgorithm } from './marks.algorithm';
import { PercentageAlgorithm } from './percentage.algorithm';

export type RankingRule = 'percentage' | 'credits' | 'marks';

/**
 * The client-facing names of the ranking rules. `TOTAL_MARKS` maps to the
 * `marks` strategy, `PERCENTAGE` to `percentage` and `CREDITS` to `credits`.
 */
const RULE_ALIASES: Record<string, RankingRule> = {
  percentage: 'percentage',
  percent: 'percentage',
  marks: 'marks',
  total_marks: 'marks',
  credits: 'credits',
  credit: 'credits',
};

/**
 * Maps a user-supplied ranking rule onto a registered strategy name.
 * Returns `null` when the rule is unknown so the caller can raise a 400 with
 * the list of supported rules.
 */
export function normaliseRankingRule(rule: string): RankingRule | null {
  return RULE_ALIASES[rule.trim().toLowerCase()] ?? null;
}

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
    const key = normaliseRankingRule(rule);
    if (!key) {
      throw new BadRequestException(
        `Unknown ranking rule: ${rule}. Use one of: ${[...this.registry.keys()].join(', ')}`
      );
    }
    const algo = this.registry.get(key);
    if (!algo) {
      throw new BadRequestException(
        `Unknown ranking rule: ${rule}. Use one of: ${[...this.registry.keys()].join(', ')}`
      );
    }
    return algo;
  }

  listSupported(): string[] {
    return [...this.registry.keys()];
  }
}
