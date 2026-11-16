/**
 * The scheme's rules, in the words the college uses.
 *
 * ## Why this module exists
 *
 * A scheme says how marks are turned into a result. That is a set of
 * numbers and a set of labels, and it used to be stored as a JSON blob
 * that only a developer could read. §4.6 of the hardening spec forbids
 * that: no end user is ever shown raw JSON.
 *
 * So the rules are expressed here as a **structured** shape — a list of
 * components, each with a name, a maximum and the marks needed to pass —
 * and this module converts that shape into the three stored forms the
 * calculators and the seed read:
 *
 *  - the **2019** shape (`required` + a per-component `passRules` map);
 *  - the **2022** shape (`hasTheory`/`hasPractical` + a grouped
 *    `passRules` map).
 *
 * The conversion is the whole point. The stored form is an implementation
 * detail of the calculators; the structured form is what a person edits.
 * Keeping the conversion in one place means the form cannot drift from
 * what the calculators expect, and the summary a clerk reads is generated
 * from the same numbers the form writes.
 *
 * ## The component names
 *
 * The college says "Internal Assessment", "Mid-Semester Exam",
 * "End-Semester Exam" and "Practical". The scheme's *internal* code names
 * differ between the schemes (`CA1`/`CA2`/`MID_SEM` in 2019, `CT`/`MID_SEM`/
 * `MICRO_PROJECT` in 2022, `CT1`/`CT2`/`MID_SEM`/`QUIZ` in 2024), so each
 * component carries both: a **label** for the person and a **key** for the
 * machine.
 */

/**
 * The role a component plays in a subject's result.
 *
 * - `internal` — the continuous assessment done during the semester.
 * - `theory` — the end-of-semester written examination.
 * - `practical` — the laboratory or workshop component.
 */
export type ComponentKind = 'internal' | 'theory' | 'practical';

/**
 * One component of a subject's mark sheet.
 */
export interface SchemeComponent {
  /**
   * The college's name for this component — "Internal Assessment",
   * "Mid-Semester Exam", "End-Semester Exam", "Practical".
   */
  label: string;
  /**
   * The machine key — `CA1`, `MID_SEM`, `WRITTEN`, `PRACTICAL`, and so on.
   *
   * This is what the calculators match against, so it is never shown to a
   * person on its own.
   */
  key: string;
  /** Which part of the result this component belongs to. */
  kind: ComponentKind;
  /** The most marks this component can carry. */
  maxMarks: number;
  /**
   * The marks a student must score in this component to pass it.
   *
   * `0` means the component has no minimum of its own — it counts towards
   * the internal total, and the internal total has its own minimum.
   */
  passMarks: number;
}

/**
 * The rules of a scheme, as a person edits them.
 */
export interface SchemeRuleSet {
  /** The scheme's name — `SCHEME_2019`, `SCHEME_2022`, `SCHEME_2024`. */
  schemeName: string;
  /** The components, in the order they are taught. */
  components: SchemeComponent[];
  /**
   * Whether the subject has a practical component.
   *
   * A subject's *scheme* may describe both a theory and a practical paper
   * (a laboratory subject), while a theory subject has only the theory
   * part. The toggle in the form turns this on and off, and turning it on
   * reveals the practical's maximum and its pass mark.
   */
  hasPractical: boolean;
  /**
   * The aggregate pass percentage — the share of the total a student must
   * score to pass the subject overall.
   */
  aggregatePassPercent: number;
}

/**
 * The component the college calls each thing, with the key the machine
 * uses.
 *
 * The keys are the ones the calculators look for: `CA1`, `CA2`, `MID_SEM`,
 * `CT`, `MICRO_PROJECT`, `CT1`, `CT2`, `QUIZ`, `WRITTEN` and `PRACTICAL`.
 */
export const COMPONENT_PRESETS: Readonly<
  Record<string, { label: string; key: string; kind: ComponentKind }>
> = {
  internal: { label: 'Internal Assessment', key: 'CA1', kind: 'internal' },
  ca1: { label: 'Continuous Assessment 1', key: 'CA1', kind: 'internal' },
  ca2: { label: 'Continuous Assessment 2', key: 'CA2', kind: 'internal' },
  ct: { label: 'Class Test', key: 'CT', kind: 'internal' },
  ct1: { label: 'Class Test 1', key: 'CT1', kind: 'internal' },
  ct2: { label: 'Class Test 2', key: 'CT2', kind: 'internal' },
  midSem: { label: 'Mid-Semester Exam', key: 'MID_SEM', kind: 'internal' },
  microProject: { label: 'Micro-Project', key: 'MICRO_PROJECT', kind: 'internal' },
  quiz: { label: 'Quiz', key: 'QUIZ', kind: 'internal' },
  theory: { label: 'End-Semester Exam', key: 'WRITTEN', kind: 'theory' },
  practical: { label: 'Practical', key: 'PRACTICAL', kind: 'practical' },
} as const;

/**
 * The 2019 scheme's components, with the marks DBATU gives them.
 *
 * The 2019 scheme is the odd one out: it carries a minimum for *every*
 * internal assessment (`CA1` ≥ 6, `CA2` ≥ 6, `MID_SEM` ≥ 8) as well as a
 * minimum for the internal total, the written paper and the practical.
 * That is why its stored shape has a `required` list and a per-component
 * `passRules` map rather than the grouped one the later schemes use.
 */
export const SCHEME_2019_COMPONENTS: readonly SchemeComponent[] = [
  { label: 'Continuous Assessment 1', key: 'CA1', kind: 'internal', maxMarks: 20, passMarks: 6 },
  { label: 'Continuous Assessment 2', key: 'CA2', kind: 'internal', maxMarks: 20, passMarks: 6 },
  { label: 'Mid-Semester Exam', key: 'MID_SEM', kind: 'internal', maxMarks: 20, passMarks: 8 },
  { label: 'End-Semester Exam', key: 'WRITTEN', kind: 'theory', maxMarks: 100, passMarks: 45 },
  { label: 'Practical', key: 'PRACTICAL', kind: 'practical', maxMarks: 25, passMarks: 10 },
];

/**
 * The 2022 scheme's components.
 *
 * The internal assessment is split three ways — a class test, the
 * mid-semester and a micro-project — and the external paper is 60 of the
 * 100 theory marks. The practical is a separate 25.
 */
export const SCHEME_2022_COMPONENTS: readonly SchemeComponent[] = [
  { label: 'Class Test', key: 'CT', kind: 'internal', maxMarks: 15, passMarks: 0 },
  { label: 'Mid-Semester Exam', key: 'MID_SEM', kind: 'internal', maxMarks: 15, passMarks: 0 },
  { label: 'Micro-Project', key: 'MICRO_PROJECT', kind: 'internal', maxMarks: 10, passMarks: 0 },
  { label: 'End-Semester Exam', key: 'WRITTEN', kind: 'theory', maxMarks: 60, passMarks: 30 },
  { label: 'Practical', key: 'PRACTICAL', kind: 'practical', maxMarks: 25, passMarks: 13 },
];

/**
 * The 2024 scheme's components.
 *
 * The internal assessment is split three ways — a class test, the
 * mid-semester and a quiz, 15 + 15 + 10 — and the external paper is 60 of
 * the 100 theory marks. The practical is a separate 25.
 *
 * The breakdown is the one the college's own scheme document publishes:
 * "Theory 100 (CT1 15 + Mid 15 + Quiz 10 = 40 Internal + 60 External) +
 * Practical 25 where applicable." The calculator recognises a `CT2` as an
 * internal component too, but the published breakdown has no class test 2,
 * so the form does not offer one — a clerk can add a row if the university
 * revises it.
 */
export const SCHEME_2024_COMPONENTS: readonly SchemeComponent[] = [
  { label: 'Class Test 1', key: 'CT1', kind: 'internal', maxMarks: 15, passMarks: 0 },
  { label: 'Mid-Semester Exam', key: 'MID_SEM', kind: 'internal', maxMarks: 15, passMarks: 0 },
  { label: 'Quiz', key: 'QUIZ', kind: 'internal', maxMarks: 10, passMarks: 0 },
  { label: 'End-Semester Exam', key: 'WRITTEN', kind: 'theory', maxMarks: 60, passMarks: 30 },
  { label: 'Practical', key: 'PRACTICAL', kind: 'practical', maxMarks: 25, passMarks: 13 },
];

/**
 * The three schemes the college runs, with their starting breakdowns.
 *
 * The form opens one of these when a new scheme is created, and reads one
 * back when an existing scheme is edited. The numbers here are the college's
 * published scheme; a clerk adjusts them if the university revises them.
 */
export const SCHEME_PRESETS: Readonly<
  Record<string, { schemeName: string; components: readonly SchemeComponent[]; aggregatePassPercent: number }>
> = {
  SCHEME_2019: {
    schemeName: 'SCHEME_2019',
    components: SCHEME_2019_COMPONENTS,
    aggregatePassPercent: 50,
  },
  SCHEME_2022: {
    schemeName: 'SCHEME_2022',
    components: SCHEME_2022_COMPONENTS,
    aggregatePassPercent: 50,
  },
  SCHEME_2024: {
    schemeName: 'SCHEME_2024',
    components: SCHEME_2024_COMPONENTS,
    aggregatePassPercent: 50,
  },
} as const;

/**
 * The names of the three schemes, in the order a dropdown offers them.
 */
export const SCHEME_NAMES = ['SCHEME_2019', 'SCHEME_2022', 'SCHEME_2024'] as const;

/**
 * The scheme's name, written the way a college clerk writes it.
 *
 * `SCHEME_2024` becomes "2024 scheme" — the code is not the label.
 */
export function schemeDisplayName(schemeName: string): string {
  const match = /^SCHEME_(\d{4})$/.exec(schemeName.trim().toUpperCase());
  if (!match) return schemeName;
  return `${match[1]} scheme`;
}

/**
 * The sum of every component's maximum marks.
 */
export function totalMaxMarks(components: readonly SchemeComponent[]): number {
  return components.reduce((sum, component) => sum + component.maxMarks, 0);
}

/**
 * The sum of the internal components' maximum marks.
 *
 * The internal assessment is the continuous work done during the
 * semester; the end-of-semester paper and the practical are not part of
 * it.
 */
export function internalMaxMarks(components: readonly SchemeComponent[]): number {
  return components
    .filter((component) => component.kind === 'internal')
    .reduce((sum, component) => sum + component.maxMarks, 0);
}

/**
 * The end-of-semester paper's maximum marks, or `0` when there is none.
 */
export function theoryMaxMarks(components: readonly SchemeComponent[]): number {
  return components
    .filter((component) => component.kind === 'theory')
    .reduce((sum, component) => sum + component.maxMarks, 0);
}

/**
 * The practical's maximum marks, or `0` when there is none.
 */
export function practicalMaxMarks(components: readonly SchemeComponent[]): number {
  return components
    .filter((component) => component.kind === 'practical')
    .reduce((sum, component) => sum + component.maxMarks, 0);
}

/**
 * The marks a student must score in the internal assessment to pass it.
 *
 * Half of the internal total, rounded down — which is what the later
 * schemes say (20 of 40), and what the 2019 scheme says in its own terms
 * (30 of 60).
 */
export function derivedInternalPass(components: readonly SchemeComponent[]): number {
  return Math.floor(internalMaxMarks(components) / 2);
}

/**
 * The marks a student must score in the end-of-semester paper to pass it.
 *
 * Half of the paper, rounded down.
 */
export function derivedTheoryPass(components: readonly SchemeComponent[]): number {
  return Math.floor(theoryMaxMarks(components) / 2);
}

/**
 * The marks a student must score in the practical to pass it.
 *
 * Half of the practical, rounded **up** — which gives the 13 of 25 the
 * college's later schemes use. The rounding is up rather than down
 * because the practical is 25 marks, and half of 25 is 12.5: the college
 * rounds in the student's favour, so a student who scores exactly half
 * passes.
 *
 * The clerk can still change this on the form — the derived value is the
 * starting point, not a rule imposed on them.
 */
export function derivedPracticalPass(components: readonly SchemeComponent[]): number {
  return Math.ceil(practicalMaxMarks(components) / 2);
}

/**
 * The aggregate pass mark in absolute marks — the share of the total a
 * student must score to pass the subject.
 */
export function derivedAggregatePass(
  components: readonly SchemeComponent[],
  aggregatePassPercent: number
): number {
  const total = totalMaxMarks(components);
  return Math.ceil((total * aggregatePassPercent) / 100);
}

/**
 * A one-line summary of the rules, written for a college clerk.
 *
 * This is what the schemes list shows instead of a JSON blob:
 *
 * > Internal Assessment 20/40 · Mid-Semester 15/40 · End-Semester 30/60 ·
 * > Pass mark 50
 *
 * The wording is the college's own — the component's name, then the marks
 * required out of the marks available.
 */
export function describeSchemeRules(ruleSet: SchemeRuleSet): string {
  const parts: string[] = [];

  for (const component of ruleSet.components) {
    parts.push(`${component.label} ${component.passMarks}/${component.maxMarks}`);
  }

  const total = totalMaxMarks(ruleSet.components);
  const aggregate = derivedAggregatePass(ruleSet.components, ruleSet.aggregatePassPercent);

  parts.push(`Pass mark ${aggregate}/${total}`);

  return parts.join(' · ');
}

/**
 * The sentences the form shows under the breakdown.
 *
 * Each one is a consequence a clerk can check, not a description of the
 * data.
 */
export function describeSchemeConsequences(ruleSet: SchemeRuleSet): string[] {
  const sentences: string[] = [];

  const internalMax = internalMaxMarks(ruleSet.components);
  const internalPass = derivedInternalPass(ruleSet.components);
  if (internalMax > 0) {
    sentences.push(
      `A student must score at least ${internalPass}/${internalMax} in the internal assessment to pass.`
    );
  }

  const theoryMax = theoryMaxMarks(ruleSet.components);
  const theoryPass = derivedTheoryPass(ruleSet.components);
  if (theoryMax > 0) {
    sentences.push(
      `A student must score at least ${theoryPass}/${theoryMax} in the end-semester exam to pass.`
    );
  }

  if (ruleSet.hasPractical) {
    const practicalMax = practicalMaxMarks(ruleSet.components);
    const practicalPass = derivedPracticalPass(ruleSet.components);
    sentences.push(
      `A student must score at least ${practicalPass}/${practicalMax} in the practical to pass.`
    );
  }

  const total = totalMaxMarks(ruleSet.components);
  const aggregate = derivedAggregatePass(ruleSet.components, ruleSet.aggregatePassPercent);
  sentences.push(
    `A student must score at least ${aggregate}/${total} (${ruleSet.aggregatePassPercent}%) across the subject to pass.`
  );

  return sentences;
}

/**
 * The stored form of a scheme's rules.
 *
 * The calculators read these shapes, so they are the contract. The two
 * shapes differ because the schemes differ — 2019 marks each internal
 * assessment separately, the later schemes mark the internal assessment
 * as a whole.
 */
export type StoredSchemeRules = Record<string, unknown>;

/**
 * Converts a structured rule set into the stored form the calculators read.
 *
 * The 2019 scheme is written in its own shape — a `required` list of the
 * components a subject must have, and a `passRules` map with a minimum
 * for every component. The 2022 and 2024 schemes share a shape: whether
 * there is a practical, and a grouped `passRules` map with the internal
 * total, the external paper, the practical and the aggregate.
 */
export function toStoredRules(ruleSet: SchemeRuleSet): StoredSchemeRules {
  if (ruleSet.schemeName === 'SCHEME_2019') {
    const passRules: Record<string, number> = {};

    for (const component of ruleSet.components) {
      passRules[component.key] = component.passMarks;
    }

    const internalMax = internalMaxMarks(ruleSet.components);
    const theoryMax = theoryMaxMarks(ruleSet.components);
    const theory = ruleSet.components.find((component) => component.kind === 'theory');

    /**
     * The 2019 scheme carries its own minimum for the written paper —
     * 45 of 100, which is *not* half of it. The scheme predates the
     * "half of each part" rule the later schemes use, so the minimum is
     * the component's own, not a derived one.
     */
    passRules.internalTotal = derivedInternalPass(ruleSet.components);
    passRules.externalWritten = theory?.passMarks ?? derivedTheoryPass(ruleSet.components);
    passRules.aggregate = ruleSet.aggregatePassPercent;

    return {
      required: ruleSet.components
        .filter((component) => component.kind !== 'practical')
        .map((component) => component.key),
      passRules: {
        ...passRules,
        ...(internalMax > 0 ? { internalMax } : {}),
        ...(theoryMax > 0 ? { externalMax: theoryMax } : {}),
      },
    };
  }

  const internalMax = internalMaxMarks(ruleSet.components);
  const theoryMax = theoryMaxMarks(ruleSet.components);
  const practicalMax = ruleSet.hasPractical ? practicalMaxMarks(ruleSet.components) : 0;
  const theory = ruleSet.components.find((component) => component.kind === 'theory');
  const practical = ruleSet.components.find((component) => component.kind === 'practical');

  /**
   * The minima are the ones the clerk confirmed on the form.
   *
   * The derived values are only the *starting point* the form offers — the
   * clerk can adjust any of them, and the scheme is saved with what they
   * confirmed. That is why the component's own `passMarks` wins over the
   * derived one: the college's 2022 and 2024 schemes use 13 of 25 for the
   * practical, which is a round-up of half, and a clerk who changes it must
   * see that change saved.
   */
  const passRules: Record<string, number> = {
    internalTotal: derivedInternalPass(ruleSet.components),
    aggregate: ruleSet.aggregatePassPercent,
  };

  if (internalMax > 0) passRules.internalMax = internalMax;
  if (theoryMax > 0) {
    passRules.externalMin = theory?.passMarks || derivedTheoryPass(ruleSet.components);
    passRules.externalMax = theoryMax;
  }
  if (practicalMax > 0) {
    passRules.practicalMin = practical?.passMarks || derivedPracticalPass(ruleSet.components);
    passRules.practicalMax = practicalMax;
  }

  return {
    hasTheory: theoryMax > 0,
    hasPractical: ruleSet.hasPractical,
    passRules,
  };
}

/**
 * Reads a stored rule set back into the structured form.
 *
 * The inverse of {@link toStoredRules}. When a scheme was saved by an
 * older version of the app — or by the seed — the stored shape is read
 * back and the form shows the numbers, never the JSON.
 */
export function fromStoredRules(
  schemeName: string,
  stored: StoredSchemeRules | null | undefined
): SchemeRuleSet | null {
  if (!stored || typeof stored !== 'object') return null;

  const preset = SCHEME_PRESETS[schemeName];
  if (!preset) return null;

  const passRules = (stored.passRules ?? {}) as Record<string, number>;

  /**
   * The 2019 shape names its components in a `required` list, and carries
   * a minimum for each. The later shapes do not name their components at
   * all — they only carry the grouped minima — so the components come from
   * the preset and the minima are applied to them.
   */
  if (schemeName === 'SCHEME_2019') {
    const components = preset.components.map((component) => ({
      ...component,
      maxMarks:
        component.kind === 'theory'
          ? (passRules.externalMax ?? component.maxMarks)
          : component.kind === 'practical'
            ? (passRules.practicalMax ?? component.maxMarks)
            : component.maxMarks,
      passMarks:
        passRules[component.key] ?? component.passMarks,
    }));

    return {
      schemeName,
      components,
      hasPractical: components.some((component) => component.kind === 'practical'),
      aggregatePassPercent: passRules.aggregate ?? preset.aggregatePassPercent,
    };
  }

  const components = preset.components.map((component) => {
    if (component.kind === 'internal') {
      return {
        ...component,
        maxMarks:
          component.maxMarks > passRules.internalMax && passRules.internalMax
            ? Math.round((component.maxMarks / internalMaxMarks(preset.components)) * passRules.internalMax)
            : component.maxMarks,
      };
    }
    if (component.kind === 'theory') {
      return {
        ...component,
        maxMarks: passRules.externalMax ?? component.maxMarks,
        passMarks: passRules.externalMin ?? component.passMarks,
      };
    }
    return {
      ...component,
      maxMarks: passRules.practicalMax ?? component.maxMarks,
      passMarks: passRules.practicalMin ?? component.passMarks,
    };
  });

  return {
    schemeName,
    components,
    hasPractical: stored.hasPractical === true,
    aggregatePassPercent: passRules.aggregate ?? preset.aggregatePassPercent,
  };
}
