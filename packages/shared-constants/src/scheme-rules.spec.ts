/**
 * The scheme rules, in the words the college uses.
 *
 * The form a clerk fills in is structured; the calculators read a stored
 * shape. The conversion between the two lives in `scheme-rules.ts`, and
 * this test proves it does what it says:
 *
 *  - each of the three schemes produces exactly the shape the seed writes
 *    and the calculators expect;
 *  - a rule set survives a round trip — what the form reads back is what
 *    the form wrote;
 *  - the sentences the form shows are consequences a clerk can check, not
 *    a restatement of the data.
 */

import {
  SCHEME_2019_COMPONENTS,
  SCHEME_2022_COMPONENTS,
  SCHEME_2024_COMPONENTS,
  SCHEME_PRESETS,
  describeSchemeConsequences,
  describeSchemeRules,
  derivedAggregatePass,
  derivedInternalPass,
  derivedPracticalPass,
  derivedTheoryPass,
  fromStoredRules,
  internalMaxMarks,
  practicalMaxMarks,
  schemeDisplayName,
  theoryMaxMarks,
  toStoredRules,
  totalMaxMarks,
  type SchemeRuleSet,
} from './scheme-rules';

describe('the stored shape of each scheme', () => {
  /**
   * The 2019 scheme marks every internal assessment separately, so its
   * stored shape names the components a subject must have and gives each
   * one a minimum.
   */
  it('writes the 2019 scheme in the shape the seed writes', () => {
    const ruleSet: SchemeRuleSet = {
      schemeName: 'SCHEME_2019',
      components: SCHEME_2019_COMPONENTS.map((c) => ({ ...c })),
      hasPractical: true,
      aggregatePassPercent: 50,
    };

    const stored = toStoredRules(ruleSet) as {
      required: string[];
      passRules: Record<string, number>;
    };

    expect(stored.required).toEqual(['CA1', 'CA2', 'MID_SEM', 'WRITTEN']);
    expect(stored.passRules.CA1).toBe(6);
    expect(stored.passRules.CA2).toBe(6);
    expect(stored.passRules.MID_SEM).toBe(8);
    expect(stored.passRules.PRACTICAL).toBe(10);
    expect(stored.passRules.internalTotal).toBe(30);
    expect(stored.passRules.externalWritten).toBe(45);
    expect(stored.passRules.aggregate).toBe(50);
  });

  /**
   * The later schemes mark the internal assessment as a whole, so their
   * stored shape is grouped: the internal total, the external paper, the
   * practical and the aggregate.
   */
  it('writes the 2022 scheme in the shape the seed writes', () => {
    const ruleSet: SchemeRuleSet = {
      schemeName: 'SCHEME_2022',
      components: SCHEME_2022_COMPONENTS.map((c) => ({ ...c })),
      hasPractical: false,
      aggregatePassPercent: 50,
    };

    const stored = toStoredRules(ruleSet) as {
      hasTheory: boolean;
      hasPractical: boolean;
      passRules: Record<string, number>;
    };

    expect(stored.hasTheory).toBe(true);
    expect(stored.hasPractical).toBe(false);
    expect(stored.passRules.internalTotal).toBe(20);
    expect(stored.passRules.internalMax).toBe(40);
    expect(stored.passRules.externalMin).toBe(30);
    expect(stored.passRules.externalMax).toBe(60);
    expect(stored.passRules.aggregate).toBe(50);
  });

  it('writes the 2024 scheme in the shape the seed writes', () => {
    const ruleSet: SchemeRuleSet = {
      schemeName: 'SCHEME_2024',
      components: SCHEME_2024_COMPONENTS.map((c) => ({ ...c })),
      hasPractical: false,
      aggregatePassPercent: 50,
    };

    const stored = toStoredRules(ruleSet) as {
      hasTheory: boolean;
      hasPractical: boolean;
      passRules: Record<string, number>;
    };

    expect(stored.hasTheory).toBe(true);
    expect(stored.hasPractical).toBe(false);
    expect(stored.passRules.internalTotal).toBe(20);
    expect(stored.passRules.internalMax).toBe(40);
    expect(stored.passRules.externalMin).toBe(30);
    expect(stored.passRules.externalMax).toBe(60);
    expect(stored.passRules.aggregate).toBe(50);
  });

  it('records the practical when the course has one', () => {
    const ruleSet: SchemeRuleSet = {
      schemeName: 'SCHEME_2024',
      components: SCHEME_2024_COMPONENTS.map((c) => ({ ...c })),
      hasPractical: true,
      aggregatePassPercent: 50,
    };

    const stored = toStoredRules(ruleSet) as {
      hasPractical: boolean;
      passRules: Record<string, number>;
    };

    expect(stored.hasPractical).toBe(true);
    expect(stored.passRules.practicalMin).toBe(13);
    expect(stored.passRules.practicalMax).toBe(25);
  });

  it('leaves the practical out when the course has none', () => {
    const ruleSet: SchemeRuleSet = {
      schemeName: 'SCHEME_2024',
      components: SCHEME_2024_COMPONENTS.filter((c) => c.kind !== 'practical'),
      hasPractical: false,
      aggregatePassPercent: 50,
    };

    const stored = toStoredRules(ruleSet) as { passRules: Record<string, number> };

    expect(stored.passRules.practicalMin).toBeUndefined();
    expect(stored.passRules.practicalMax).toBeUndefined();
  });
});

describe('reading a stored rule set back', () => {
  it.each(['SCHEME_2019', 'SCHEME_2022', 'SCHEME_2024'])(
    'round-trips %s',
    (schemeName) => {
      const preset = SCHEME_PRESETS[schemeName];
      const ruleSet: SchemeRuleSet = {
        schemeName,
        components: preset.components.map((c) => ({ ...c })),
        hasPractical: true,
        aggregatePassPercent: 50,
      };

      const stored = toStoredRules(ruleSet);
      const read = fromStoredRules(schemeName, stored);

      expect(read).not.toBeNull();
      expect(read?.schemeName).toBe(schemeName);
      expect(read?.aggregatePassPercent).toBe(50);
      expect(read?.components.map((c) => c.key)).toEqual(
        preset.components.map((c) => c.key)
      );
    }
  );

  it('reads the seed\'s own 2019 shape back into the same numbers', () => {
    /**
     * Exactly what `apps/backend/prisma/seed.ts` writes.
     */
    const seedShape = {
      required: ['CA1', 'CA2', 'MID_SEM', 'WRITTEN'],
      passRules: {
        CA1: 6,
        CA2: 6,
        MID_SEM: 8,
        PRACTICAL: 10,
        internalTotal: 30,
        externalWritten: 45,
        aggregate: 50,
      },
    };

    const read = fromStoredRules('SCHEME_2019', seedShape);

    expect(read).not.toBeNull();
    expect(read?.components.find((c) => c.key === 'CA1')?.passMarks).toBe(6);
    expect(read?.components.find((c) => c.key === 'MID_SEM')?.passMarks).toBe(8);
    expect(read?.components.find((c) => c.key === 'WRITTEN')?.passMarks).toBe(45);
    expect(read?.components.find((c) => c.key === 'PRACTICAL')?.passMarks).toBe(10);
    expect(read?.aggregatePassPercent).toBe(50);
  });

  it('reads the seed\'s own 2024 shape back into the same numbers', () => {
    const seedShape = {
      hasTheory: true,
      hasPractical: false,
      passRules: {
        internalTotal: 20,
        internalMax: 40,
        externalMin: 30,
        externalMax: 60,
        practicalMin: 13,
        practicalMax: 25,
        aggregate: 50,
      },
    };

    const read = fromStoredRules('SCHEME_2024', seedShape);

    expect(read?.hasPractical).toBe(false);
    expect(read?.components.find((c) => c.key === 'WRITTEN')?.maxMarks).toBe(60);
    expect(read?.components.find((c) => c.key === 'WRITTEN')?.passMarks).toBe(30);
    expect(read?.components.find((c) => c.key === 'PRACTICAL')?.maxMarks).toBe(25);
    expect(read?.components.find((c) => c.key === 'PRACTICAL')?.passMarks).toBe(13);
  });

  it('reads nothing from a rule set that is not there', () => {
    expect(fromStoredRules('SCHEME_2024', null)).toBeNull();
    expect(fromStoredRules('SCHEME_2024', undefined)).toBeNull();
  });

  it('reads nothing from a scheme it does not know', () => {
    expect(fromStoredRules('SCHEME_1999', { passRules: {} })).toBeNull();
  });
});

describe('the totals', () => {
  it('adds up every component', () => {
    /**
     * The 2024 scheme: internal 40 (CT1 15 + Mid-Sem 15 + Quiz 10) +
     * external 60 + practical 25.
     */
    expect(totalMaxMarks(SCHEME_2024_COMPONENTS)).toBe(125);
  });

  it('adds up only the internal components', () => {
    expect(internalMaxMarks(SCHEME_2024_COMPONENTS)).toBe(40);
    expect(internalMaxMarks(SCHEME_2019_COMPONENTS)).toBe(60);
  });

  it('adds up only the end-semester paper', () => {
    expect(theoryMaxMarks(SCHEME_2024_COMPONENTS)).toBe(60);
    expect(theoryMaxMarks(SCHEME_2019_COMPONENTS)).toBe(100);
  });

  it('adds up only the practical', () => {
    expect(practicalMaxMarks(SCHEME_2024_COMPONENTS)).toBe(25);
  });

  it('derives the internal minimum as half the internal total', () => {
    expect(derivedInternalPass(SCHEME_2024_COMPONENTS)).toBe(20);
    expect(derivedInternalPass(SCHEME_2019_COMPONENTS)).toBe(30);
  });

  it('derives the theory minimum as half the paper', () => {
    expect(derivedTheoryPass(SCHEME_2024_COMPONENTS)).toBe(30);
    expect(derivedTheoryPass(SCHEME_2019_COMPONENTS)).toBe(50);
  });

  it('derives the practical minimum as half the practical', () => {
    expect(derivedPracticalPass(SCHEME_2024_COMPONENTS)).toBe(13);
  });

  it('derives the aggregate as the share of the total', () => {
    expect(derivedAggregatePass(SCHEME_2024_COMPONENTS, 50)).toBe(63);
  });
});

describe('the sentences a clerk reads', () => {
  const ruleSet: SchemeRuleSet = {
    schemeName: 'SCHEME_2024',
    components: SCHEME_2024_COMPONENTS.map((c) => ({ ...c })),
    hasPractical: true,
    aggregatePassPercent: 50,
  };

  it('summarises the rules in the college\'s own words', () => {
    const summary = describeSchemeRules(ruleSet);

    expect(summary).toContain('Class Test 1');
    expect(summary).toContain('End-Semester Exam');
    expect(summary).toContain('Practical');
    expect(summary).toContain('Pass mark');
    expect(summary).not.toMatch(/[{}\[\]"]/);
  });

  it('spells out the practical consequence', () => {
    const sentences = describeSchemeConsequences(ruleSet);

    expect(sentences.join(' ')).toContain(
      'A student must score at least 13/25 in the practical to pass.'
    );
  });

  it('spells out the internal consequence', () => {
    const sentences = describeSchemeConsequences(ruleSet);

    expect(sentences.join(' ')).toContain(
      'A student must score at least 20/40 in the internal assessment to pass.'
    );
  });

  it('says nothing about a practical the course does not have', () => {
    const withoutPractical: SchemeRuleSet = {
      ...ruleSet,
      hasPractical: false,
      components: ruleSet.components.filter((c) => c.kind !== 'practical'),
    };

    const sentences = describeSchemeConsequences(withoutPractical);

    expect(sentences.join(' ')).not.toContain('in the practical to pass');
  });

  it('never shows a developer-facing word', () => {
    const summary = describeSchemeRules(ruleSet);
    const sentences = describeSchemeConsequences(ruleSet);

    for (const text of [summary, ...sentences]) {
      expect(text).not.toMatch(/undefined|null|NaN|JSON|passRules|aggregate/i);
    }
  });
});

describe('the scheme name a clerk reads', () => {
  it('writes the code as words', () => {
    expect(schemeDisplayName('SCHEME_2024')).toBe('2024 scheme');
    expect(schemeDisplayName('scheme_2019')).toBe('2019 scheme');
  });

  it('leaves a name it does not recognise alone', () => {
    expect(schemeDisplayName('CUSTOM')).toBe('CUSTOM');
  });
});
