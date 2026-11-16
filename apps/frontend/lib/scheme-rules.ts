/**
 * The scheme's rules, in the words the college uses.
 *
 * The rules used to be a JSON blob typed into a textarea. §4.6 of the
 * hardening spec forbids showing JSON to an end user, so the rules are
 * expressed as a **structured** shape — a list of components with a name,
 * a maximum and the marks needed to pass — and converted to the stored
 * shape the calculators read.
 *
 * The conversion lives in `packages/shared-constants/src/scheme-rules.ts`,
 * because the stored shape is a contract with the backend's calculators and
 * must not be spelled twice. This module re-exports it so the frontend's
 * imports stay short and there is one obvious place to look.
 */

export {
  COMPONENT_PRESETS,
  SCHEME_2019_COMPONENTS,
  SCHEME_2022_COMPONENTS,
  SCHEME_2024_COMPONENTS,
  SCHEME_NAMES,
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
} from '@result-analysis/shared-constants';

export type {
  ComponentKind,
  SchemeComponent,
  SchemeRuleSet,
  StoredSchemeRules,
} from '@result-analysis/shared-constants';
