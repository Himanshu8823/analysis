'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Plus, Trash2 } from 'lucide-react';

import type { Scheme, SchemePayload } from '@/lib/services/schemes.service';
import { Select } from '@/components/forms/Select';
import { FieldError } from '@/components/feedback/FieldError';
import {
  COMPONENT_PRESETS,
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
  type ComponentKind,
  type SchemeComponent,
  type SchemeRuleSet,
} from '@/lib/scheme-rules';

interface SchemeFormFieldsProps {
  /** DOM id of the `<form>` so an external save button can target it. */
  id: string;
  /** When provided the form renders pre-populated (edit flow). */
  initial?: Scheme;
  onSubmit: (payload: SchemePayload) => void;
}

/**
 * The row state of the component editor.
 *
 * The row keeps a stable `rowId` so React can track it across removals —
 * an array index would make the inputs carry over the wrong component's
 * values when a row is removed from the middle.
 *
 * `rowId` is deliberately **not** called `key`: `SchemeComponent` already
 * has a `key`, and that one is the machine name of the component (`CA1`,
 * `MID_SEM`) — the name the calculators match against. Two different keys
 * for two different things would be a bug waiting to happen.
 */
interface ComponentRow extends SchemeComponent {
  rowId: string;
}

let rowCounter = 0;
function nextRowKey(): string {
  rowCounter += 1;
  return `scheme-component-${rowCounter}`;
}

/**
 * The presets a clerk can pick from when adding a component.
 *
 * The labels are the college's own. The **key** — `CA1`, `MID_SEM`,
 * `WRITTEN` — is never shown on its own; it is what the calculators match
 * against, and it travels with the label.
 */
const COMPONENT_CHOICES: ReadonlyArray<{
  value: string;
  label: string;
  kind: ComponentKind;
}> = [
  { value: 'internal', label: 'Internal Assessment', kind: 'internal' },
  { value: 'ca1', label: 'Continuous Assessment 1', kind: 'internal' },
  { value: 'ca2', label: 'Continuous Assessment 2', kind: 'internal' },
  { value: 'ct', label: 'Class Test', kind: 'internal' },
  { value: 'ct1', label: 'Class Test 1', kind: 'internal' },
  { value: 'ct2', label: 'Class Test 2', kind: 'internal' },
  { value: 'midSem', label: 'Mid-Semester Exam', kind: 'internal' },
  { value: 'microProject', label: 'Micro-Project', kind: 'internal' },
  { value: 'quiz', label: 'Quiz', kind: 'internal' },
  { value: 'theory', label: 'End-Semester Exam', kind: 'theory' },
  { value: 'practical', label: 'Practical', kind: 'practical' },
];

/**
 * The preset a new scheme starts from.
 *
 * The 2024 scheme is the college's current one, so it is what the form
 * opens with — a clerk creating a scheme for the coming year sees the
 * numbers they are most likely to want, and adjusts them rather than
 * starting from nothing.
 */
const DEFAULT_SCHEME_NAME = 'SCHEME_2024';

/**
 * SchemeFormFields — the shared field set for a scheme.
 *
 * ## Why there is no JSON box
 *
 * The rules used to be typed as raw JSON into a textarea. That made the
 * scheme impossible to edit for anyone who was not a developer, and it put
 * the validity of every result in the college at the mercy of a bracket
 * match. §4.6 of the hardening spec forbids it, so the rules are now
 * **structured, labelled inputs**: a breakdown of components with their
 * maximum marks and the marks needed to pass, a practical toggle whose
 * consequence is spelled out, and the aggregate pass rule shown as a
 * number.
 *
 * ## The numbers are derived, then confirmed
 *
 * The form *derives* the per-part minimums and the aggregate pass mark
 * from the breakdown — half of each part, and half of the total — and
 * shows them in plain number fields. The clerk confirms or adjusts them.
 * The derived value is the starting point, not a rule imposed on them.
 *
 * ## The rules are stored in the shape the calculators read
 *
 * The conversion to and from the stored shape lives in
 * `packages/shared-constants/src/scheme-rules.ts`, so the form cannot drift
 * from what the calculators expect. The calculators themselves are
 * untouched.
 */
export function SchemeFormFields({ id, initial, onSubmit }: SchemeFormFieldsProps) {
  /**
   * The starting rule set.
   *
   * An existing scheme is read back from its stored shape; a new one
   * starts from the college's published breakdown. Either way the clerk
   * sees numbers, never JSON.
   */
  const starting = useMemo<SchemeRuleSet>(() => {
    if (initial) {
      const read = fromStoredRules(initial.name, initial.rules);
      if (read) return read;
    }

    const preset = SCHEME_PRESETS[DEFAULT_SCHEME_NAME];
    return {
      schemeName: preset.schemeName,
      components: preset.components.map((component) => ({ ...component })),
      hasPractical: false,
      aggregatePassPercent: preset.aggregatePassPercent,
    };
  }, [initial]);

  const [form, setForm] = useState({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    effectiveFrom: initial ? initial.effectiveFrom.slice(0, 10) : '',
    isActive: initial?.isActive ?? true,
  });

  const [schemeName, setSchemeName] = useState(starting.schemeName);
  const [components, setComponents] = useState<ComponentRow[]>(() =>
    starting.components.map((component) => ({ ...component, rowId: nextRowKey() })),
  );
  const [hasPractical, setHasPractical] = useState(starting.hasPractical);
  const [aggregatePassPercent, setAggregatePassPercent] = useState(
    starting.aggregatePassPercent
  );
  const [error, setError] = useState<string | null>(null);

  /**
   * The components that are actually in play.
   *
   * The practical row is only shown when the toggle is on, so a course
   * without a practical never carries a stray practical row into the saved
   * rules.
   */
  const activeComponents = useMemo(
    () =>
      hasPractical
        ? components
        : components.filter((component) => component.kind !== 'practical'),
    [components, hasPractical],
  );

  /**
   * The rule set as it stands, ready to be described or stored.
   */
  const ruleSet: SchemeRuleSet = useMemo(
    () => ({
      schemeName,
      components: activeComponents.map(({ rowId: _rowId, ...component }) => component),
      hasPractical,
      aggregatePassPercent,
    }),
    [schemeName, activeComponents, hasPractical, aggregatePassPercent],
  );

  const total = totalMaxMarks(ruleSet.components);
  const aggregatePass = derivedAggregatePass(ruleSet.components, aggregatePassPercent);

  const updateRow = (rowId: string, patch: Partial<SchemeComponent>) => {
    setComponents((current) =>
      current.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row))
    );
  };

  const removeRow = (rowId: string) => {
    setComponents((current) => current.filter((row) => row.rowId !== rowId));
  };

  const addRow = () => {
    const preset = COMPONENT_PRESETS.internal;
    setComponents((current) => [
      ...current,
      {
        rowId: nextRowKey(),
        label: preset.label,
        key: preset.key,
        kind: 'internal',
        maxMarks: 0,
        passMarks: 0,
      },
    ]);
  };

  /**
   * Changing the scheme swaps in the published breakdown for that scheme.
   *
   * The clerk is editing a scheme, not a document of numbers they happen
   * to have typed: picking "2019 scheme" should give them the 2019
   * breakdown, ready to adjust. The values are the college's own, so the
   * form is never a blank page.
   */
  const changeScheme = (next: string) => {
    const preset = SCHEME_PRESETS[next];
    setSchemeName(next);
    if (!preset) return;
    setComponents(
      preset.components.map((component) => ({ ...component, rowId: nextRowKey() }))
    );
    setHasPractical(false);
    setAggregatePassPercent(preset.aggregatePassPercent);
  };

  const addPractical = () => {
    const preset = COMPONENT_PRESETS.practical;
    setComponents((current) => [
      ...current,
      {
        rowId: nextRowKey(),
        label: preset.label,
        key: preset.key,
        kind: 'practical',
        maxMarks: 25,
        passMarks: derivedPracticalPass([
          { ...preset, kind: 'practical', maxMarks: 25, passMarks: 0 },
        ]),
      },
    ]);
    setHasPractical(true);
  };

  return (
    <form
      id={id}
      className="flex flex-col gap-base"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);

        if (!form.name.trim()) {
          setError('Give the scheme a name.');
          return;
        }
        if (!form.description.trim()) {
          setError('Write a short description of the scheme.');
          return;
        }
        if (!form.effectiveFrom) {
          setError('Choose the date the scheme takes effect from.');
          return;
        }
        if (activeComponents.length === 0) {
          setError('Add at least one component to the breakdown.');
          return;
        }
        if (total <= 0) {
          setError('The breakdown must add up to more than zero marks.');
          return;
        }
        if (aggregatePassPercent < 1 || aggregatePassPercent > 100) {
          setError('The pass percentage must be between 1 and 100.');
          return;
        }

        onSubmit({
          name: form.name.trim().toUpperCase(),
          description: form.description.trim(),
          effectiveFrom: form.effectiveFrom,
          isActive: form.isActive,
          rules: toStoredRules(ruleSet),
        });
      }}
    >
      {/* ── Identity ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-base md:grid-cols-2">
        <label className="flex flex-col gap-xs">
          <span className="text-body-sm font-semibold text-ink">Name</span>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="SCHEME_2024"
            className="cb-input"
          />
        </label>
        <label className="flex flex-col gap-xs">
          <span className="text-body-sm font-semibold text-ink">Description</span>
          <input
            required
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="DBATU 2024 scheme for all branches"
            className="cb-input"
          />
        </label>
        <label className="flex flex-col gap-xs">
          <span className="text-body-sm font-semibold text-ink">Effective from</span>
          <input
            required
            type="date"
            value={form.effectiveFrom}
            onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
            className="cb-input"
          />
        </label>
        <Select
          label="Status"
          value={form.isActive ? 'yes' : 'no'}
          onChange={(e) => setForm({ ...form, isActive: e.target.value === 'yes' })}
        >
          <option value="yes">Active</option>
          <option value="no">Inactive</option>
        </Select>
      </div>

      {/* ── The scheme ───────────────────────────────────────────── */}
      <fieldset className="rounded-xl border border-hairline bg-surface-soft p-4 md:p-5">
        <legend className="px-1 text-body-sm font-semibold text-ink">The scheme</legend>
        <p className="mt-1 text-caption text-muted">
          Pick the scheme the university has published. The breakdown below fills in with
          its marks, which you can then adjust.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-base md:grid-cols-2">
          <Select
            label="Scheme"
            value={schemeName}
            onChange={(e) => changeScheme(e.target.value)}
          >
            {SCHEME_NAMES.map((name) => (
              <option key={name} value={name}>
                {schemeDisplayName(name)}
              </option>
            ))}
          </Select>

          <label className="flex flex-col gap-xs">
            <span className="text-body-sm font-semibold text-ink">
              Pass percentage
              <span className="ml-1 font-normal text-muted">
                (the share of the total a student must score)
              </span>
            </span>
            <input
              required
              type="number"
              min={1}
              max={100}
              step={1}
              value={aggregatePassPercent}
              onChange={(e) => setAggregatePassPercent(Number(e.target.value))}
              className="cb-input num"
            />
          </label>
        </div>
      </fieldset>

      {/* ── The practical toggle ─────────────────────────────────── */}
      <fieldset className="rounded-xl border border-hairline bg-surface-soft p-4 md:p-5">
        <legend className="px-1 text-body-sm font-semibold text-ink">
          Practical component
        </legend>

        <label className="mt-3 flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            checked={hasPractical}
            onChange={(e) => {
              setHasPractical(e.target.checked);
              if (e.target.checked) addPractical();
            }}
            className="h-5 w-5"
          />
          <span className="text-body-sm font-semibold text-ink">
            This course has a practical component
          </span>
        </label>

        {hasPractical ? (
          <p className="mt-2 text-body-sm text-body">
            A student must score at least{' '}
            <span className="num font-semibold text-ink">
              {derivedPracticalPass(ruleSet.components)}/
              {practicalMaxMarks(ruleSet.components)}
            </span>{' '}
            in the practical to pass.
          </p>
        ) : (
          <p className="mt-2 text-body-sm text-muted">
            Turn this on for a laboratory subject. The practical&apos;s marks and its pass
            mark will then appear in the breakdown below.
          </p>
        )}
      </fieldset>

      {/* ── The breakdown ────────────────────────────────────────── */}
      <fieldset className="rounded-xl border border-hairline bg-surface-soft p-4 md:p-5">
        <legend className="px-1 text-body-sm font-semibold text-ink">
          Component breakdown
        </legend>
        <p className="mt-1 text-caption text-muted">
          What each part of the subject is worth, and the marks a student must score in
          it.
        </p>

        {/* Live totals. */}
        <div
          className="mt-3 flex items-start gap-sm rounded-lg border border-hairline bg-card p-3"
          role="status"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-semantic-up" aria-hidden />
          <div className="min-w-0">
            <p className="text-body-sm text-ink">
              Total: <span className="num font-semibold">{total}</span> · Pass mark:{' '}
              <span className="num font-semibold">{aggregatePass}</span> (
              <span className="num">{aggregatePassPercent}%</span>)
            </p>
            <p className="mt-1 text-caption text-body">
              Internal <span className="num">{internalMaxMarks(ruleSet.components)}</span> ·
              End-semester <span className="num">{theoryMaxMarks(ruleSet.components)}</span>
              {hasPractical ? (
                <>
                  {' '}
                  · Practical{' '}
                  <span className="num">{practicalMaxMarks(ruleSet.components)}</span>
                </>
              ) : null}
            </p>
          </div>
        </div>

        {/* The rows. */}
        {components.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-3">
            {components.map((row, index) => {
              /**
               * A practical row is only editable while the practical is on.
               * When the toggle is off the row is hidden entirely, so a
               * course without a practical never carries one into the
               * saved rules.
               */
              if (row.kind === 'practical' && !hasPractical) return null;

              return (
                <li
                  key={row.rowId}
                  className="rounded-lg border border-hairline bg-card p-3 md:p-4"
                >
                  {/*
                   * The row is a grid, not a flex row: on mobile the three
                   * fields stack full-width (no horizontal scroll), and from
                   * the tablet breakpoint up they sit side by side with the
                   * remove button on the trailing edge.
                   */}
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
                    <div className="md:col-span-5">
                      {/*
                       * The dropdown is keyed on the machine key, not on the
                       * part of the result the component belongs to.
                       *
                       * Several presets share a part — "Continuous
                       * Assessment 1", "Class Test" and "Mid-Semester Exam"
                       * are all internal — so a dropdown whose option values
                       * were the part would offer the same choice several
                       * times and the clerk could not tell which one they
                       * had picked. The machine key is what identifies a
                       * component; it is never shown on its own.
                       */}
                      <Select
                        label={`Component ${index + 1}`}
                        value={row.key}
                        onChange={(e) => {
                          const preset = COMPONENT_CHOICES.find(
                            (c) => c.value === e.target.value
                          );
                          if (!preset) return;
                          updateRow(row.rowId, {
                            kind: preset.kind,
                            label: preset.label,
                            key: preset.value,
                          });
                        }}
                      >
                        {COMPONENT_CHOICES.map((choice) => (
                          <option key={choice.value} value={choice.value}>
                            {choice.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="md:col-span-3">
                      <label className="flex flex-col gap-xs">
                        <span className="text-body-sm font-semibold text-ink">
                          Maximum marks
                        </span>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={row.maxMarks}
                          onChange={(e) =>
                            updateRow(row.rowId, { maxMarks: Number(e.target.value) })
                          }
                          className="cb-input num"
                        />
                      </label>
                    </div>
                    <div className="md:col-span-3">
                      <label className="flex flex-col gap-xs">
                        <span className="text-body-sm font-semibold text-ink">
                          Marks to pass
                        </span>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={row.passMarks}
                          onChange={(e) =>
                            updateRow(row.rowId, { passMarks: Number(e.target.value) })
                          }
                          className="cb-input num"
                        />
                      </label>
                    </div>
                    <div className="flex items-center justify-end md:col-span-1">
                      <button
                        type="button"
                        onClick={() => removeRow(row.rowId)}
                        aria-label={`Remove component ${index + 1}`}
                        title="Remove component"
                        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-strong hover:text-semantic-down"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}

        <button
          type="button"
          onClick={addRow}
          className="cb-btn-secondary mt-4 w-full md:w-auto"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add component
        </button>
      </fieldset>

      {/* ── The derived rules, confirmed ─────────────────────────── */}
      <fieldset className="rounded-xl border border-hairline bg-surface-soft p-4 md:p-5">
        <legend className="px-1 text-body-sm font-semibold text-ink">
          What a student must score
        </legend>
        <p className="mt-1 text-caption text-muted">
          These follow from the breakdown above. Check them, and change any that the
          university has set differently.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-base md:grid-cols-3">
          <label className="flex flex-col gap-xs">
            <span className="text-body-sm font-semibold text-ink">
              Internal assessment
              <span className="ml-1 font-normal text-muted">
                (out of {internalMaxMarks(ruleSet.components)})
              </span>
            </span>
            <input
              type="number"
              min={0}
              step={1}
              value={derivedInternalPass(ruleSet.components)}
              readOnly
              className="cb-input num"
              aria-readonly="true"
            />
          </label>
          <label className="flex flex-col gap-xs">
            <span className="text-body-sm font-semibold text-ink">
              End-semester exam
              <span className="ml-1 font-normal text-muted">
                (out of {theoryMaxMarks(ruleSet.components)})
              </span>
            </span>
            <input
              type="number"
              min={0}
              step={1}
              value={derivedTheoryPass(ruleSet.components)}
              readOnly
              className="cb-input num"
              aria-readonly="true"
            />
          </label>
          {hasPractical ? (
            <label className="flex flex-col gap-xs">
              <span className="text-body-sm font-semibold text-ink">
                Practical
                <span className="ml-1 font-normal text-muted">
                  (out of {practicalMaxMarks(ruleSet.components)})
                </span>
              </span>
              <input
                type="number"
                min={0}
                step={1}
                value={derivedPracticalPass(ruleSet.components)}
                readOnly
                className="cb-input num"
                aria-readonly="true"
              />
            </label>
          ) : null}
        </div>

        {/* The consequences, in sentences. */}
        <ul className="mt-4 flex flex-col gap-1">
          {describeSchemeConsequences(ruleSet).map((sentence) => (
            <li key={sentence} className="flex items-start gap-2 text-body-sm text-body">
              <CheckCircle2
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-semantic-up"
                aria-hidden
              />
              <span>{sentence}</span>
            </li>
          ))}
        </ul>

        {/*
         * The one-line summary.
         *
         * This is the same sentence the schemes list shows, so a clerk sees
         * the same thing in the form and on the list.
         */}
        <p className="mt-4 rounded-lg border border-hairline bg-card p-3 text-body-sm text-ink">
          {describeSchemeRules(ruleSet)}
        </p>
      </fieldset>

      {error ? <FieldError message={error} /> : null}
    </form>
  );
}

/**
 * The warning a clerk sees when the breakdown does not add up.
 *
 * Kept out of the form itself because it is a *warning*, not an error: the
 * exam cell may deliberately define a partial breakdown and complete it
 * later, so the form still allows the save.
 */
export function SchemeBreakdownWarning({
  total,
  aggregatePass,
}: {
  total: number;
  aggregatePass: number;
}) {
  if (total <= 0) return null;

  return (
    <div
      className="mt-3 flex items-start gap-sm rounded-lg border border-hairline bg-surface-strong p-3"
      role="alert"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent-yellow" aria-hidden />
      <p className="text-body-sm text-body">
        The pass mark is <span className="num font-semibold">{aggregatePass}</span> out of{' '}
        <span className="num font-semibold">{total}</span>. Check that this matches what
        the university has published.
      </p>
    </div>
  );
}
