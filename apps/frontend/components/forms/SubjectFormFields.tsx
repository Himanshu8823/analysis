'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';

import { Select } from '@/components/forms/Select';
import { FieldError } from '@/components/feedback/FieldError';
import {
  EXAM_TYPES,
  isExamType,
  normalizeComponents,
  type Subject,
  type SubjectComponent,
  type SubjectPayload,
} from '@/lib/services/subjects.service';
import type { ExamType } from '@result-analysis/shared-types';

/**
 * The row state of the component editor.
 *
 * The row keeps a stable `key` so React can track it across reorders and
 * deletions — an array index would make the inputs carry over the wrong
 * component's values when a row is removed from the middle.
 */
interface ComponentRow extends SubjectComponent {
  key: string;
}

interface SubjectFormFieldsProps {
  /** DOM id of the `<form>` so an external save button can target it. */
  id: string;
  /** When provided the form renders pre-populated (edit flow). */
  initial?: Subject;
  onSubmit: (payload: SubjectPayload) => void;
}

/** The exam types, with a human label for the dropdown. */
const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  CA1: 'CA1 — Continuous assessment 1',
  CA2: 'CA2 — Continuous assessment 2',
  MID_SEM: 'Mid semester',
  WRITTEN: 'Written paper',
  PRACTICAL: 'Practical',
  ORAL: 'Oral',
};

let rowCounter = 0;
function nextRowKey(): string {
  rowCounter += 1;
  return `component-${rowCounter}`;
}

/**
 * SubjectFormFields — the shared field set for a subject.
 *
 * A subject is a *template*: it says what each assessment is worth, never
 * what a student scored. The component breakdown is therefore the heart of
 * this form, and the live sum check next to it is the point — an exam cell
 * that defines a 75-mark paper but a breakdown that adds up to 80 will
 * silently mis-grade every student who takes it.
 *
 * One component serves both the "new subject" and "edit subject" pages: the
 * create page renders it with no `initial`, the edit page renders it with
 * the fetched record.
 */
export function SubjectFormFields({ id, initial, onSubmit }: SubjectFormFieldsProps) {
  const [form, setForm] = useState({
    code: initial?.code ?? '',
    name: initial?.name ?? '',
    credits: initial?.credits ?? 4,
    maxMarks: initial?.maxMarks ?? 100,
    passingMarks: initial?.passingMarks ?? 40,
    isActive: initial?.isActive ?? true,
  });
  const [rows, setRows] = useState<ComponentRow[]>(() =>
    normalizeComponents(initial?.components).map((component) => ({
      ...component,
      key: nextRowKey(),
    })),
  );
  const [error, setError] = useState<string | null>(null);

  /**
   * The sum of the component max marks.
   *
   * A row whose max marks is blank or not a number contributes zero rather
   * than `NaN` — the user is mid-edit more often than not, and a `NaN` total
   * would make the warning message unreadable.
   */
  const componentTotal = useMemo(
    () =>
      rows.reduce((sum, row) => {
        const value = Number(row.maxMarks);
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0),
    [rows],
  );

  /**
   * Whether the breakdown adds up to the subject's max marks.
   *
   * `null` means there is nothing to compare yet — no components have been
   * defined — so no warning is shown. A mismatch is a warning, not an error:
   * the exam cell may legitimately define a partial breakdown and complete it
   * later, so the form still allows the save.
   */
  const sumState: 'ok' | 'mismatch' | 'empty' = useMemo(() => {
    if (rows.length === 0) return 'empty';
    return componentTotal === form.maxMarks ? 'ok' : 'mismatch';
  }, [rows.length, componentTotal, form.maxMarks]);

  const addRow = () => {
    setRows((current) => [
      ...current,
      { key: nextRowKey(), type: 'CA1', maxMarks: 0 },
    ]);
  };

  const removeRow = (key: string) => {
    setRows((current) => current.filter((row) => row.key !== key));
  };

  const updateRow = (key: string, patch: Partial<SubjectComponent>) => {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  };

  return (
    <form
      id={id}
      className="flex flex-col gap-base"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);

        if (!form.code.trim()) {
          setError('Enter a subject code.');
          return;
        }
        if (!form.name.trim()) {
          setError('Enter a subject name.');
          return;
        }
        if (form.maxMarks <= 0) {
          setError('Max marks must be greater than zero.');
          return;
        }
        if (form.passingMarks < 0) {
          setError('Passing marks cannot be negative.');
          return;
        }
        if (form.passingMarks > form.maxMarks) {
          setError('Passing marks cannot be greater than max marks.');
          return;
        }

        onSubmit({
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          credits: Number(form.credits),
          maxMarks: Number(form.maxMarks),
          passingMarks: Number(form.passingMarks),
          isActive: form.isActive,
          components: rows.map((row) => ({
            type: row.type,
            maxMarks: Number(row.maxMarks) || 0,
            ...(row.passingMarks === undefined
              ? {}
              : { passingMarks: Number(row.passingMarks) || 0 }),
          })),
        });
      }}
    >
      {/* ── Identity ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-base md:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-xs">
          <span className="text-body-sm font-semibold text-ink">Subject code</span>
          <input
            required
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            placeholder="CS301"
            className="cb-input num"
          />
        </label>
        <label className="flex flex-col gap-xs md:col-span-1 lg:col-span-2">
          <span className="text-body-sm font-semibold text-ink">Subject name</span>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Data Structures"
            className="cb-input"
          />
        </label>
        <label className="flex flex-col gap-xs">
          <span className="text-body-sm font-semibold text-ink">Credits</span>
          <input
            required
            type="number"
            min={1}
            step={1}
            value={form.credits}
            onChange={(e) => setForm({ ...form, credits: Number(e.target.value) })}
            className="cb-input num"
          />
        </label>
        <label className="flex flex-col gap-xs">
          <span className="text-body-sm font-semibold text-ink">Max marks</span>
          <input
            required
            type="number"
            min={1}
            step={1}
            value={form.maxMarks}
            onChange={(e) => setForm({ ...form, maxMarks: Number(e.target.value) })}
            className="cb-input num"
          />
        </label>
        <label className="flex flex-col gap-xs">
          <span className="text-body-sm font-semibold text-ink">Passing marks</span>
          <input
            required
            type="number"
            min={0}
            step={1}
            value={form.passingMarks}
            onChange={(e) => setForm({ ...form, passingMarks: Number(e.target.value) })}
            className="cb-input num"
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

      {/* ── Component breakdown ───────────────────────────────────── */}
      <fieldset className="rounded-xl border border-hairline bg-surface-soft p-4 md:p-5">
        <legend className="px-1 text-body-sm font-semibold text-ink">
          Component breakdown
        </legend>
        <p className="mt-1 text-caption text-muted">
          The assessment template a teacher later fills in — what each part is
          worth, not what any student scored.
        </p>

        {/* Live sum check. */}
        <div
          className={`mt-3 flex items-start gap-sm rounded-lg border border-hairline p-3 ${
            sumState === 'mismatch' ? 'bg-surface-strong' : 'bg-card'
          }`}
          role={sumState === 'mismatch' ? 'alert' : undefined}
        >
          {sumState === 'mismatch' ? (
            <AlertTriangle
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent-yellow"
              aria-hidden
            />
          ) : (
            <CheckCircle2
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-semantic-up"
              aria-hidden
            />
          )}
          <div className="min-w-0">
            <p className="text-body-sm text-ink">
              Components total{' '}
              <span className="num font-semibold">{componentTotal}</span> of{' '}
              <span className="num font-semibold">{form.maxMarks}</span> max marks
            </p>
            {sumState === 'mismatch' ? (
              <p className="mt-1 text-caption text-body">
                The breakdown does not add up to the subject&apos;s max marks (
                <span className="num">
                  {componentTotal - form.maxMarks > 0
                    ? `${componentTotal - form.maxMarks} over`
                    : `${form.maxMarks - componentTotal} short`}
                </span>
                ). Adjust the components or the max marks before saving.
              </p>
            ) : sumState === 'empty' ? (
              <p className="mt-1 text-caption text-body">
                No components defined yet — the subject is graded as a single
                total unless a breakdown is added.
              </p>
            ) : (
              <p className="mt-1 text-caption text-body">
                The breakdown adds up to the subject&apos;s max marks.
              </p>
            )}
          </div>
        </div>

        {/* The rows. */}
        {rows.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-3">
            {rows.map((row, index) => (
              <li
                key={row.key}
                className="rounded-lg border border-hairline bg-card p-3 md:p-4"
              >
                {/*
                  The row is a grid, not a flex row: on mobile the three
                  fields stack full-width (no horizontal scroll), and from the
                  tablet breakpoint up they sit side by side with the remove
                  button on the trailing edge.
                */}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
                  <div className="md:col-span-5">
                    <Select
                      label={`Exam type ${index + 1}`}
                      value={row.type}
                      onChange={(e) => {
                        const next = e.target.value;
                        if (isExamType(next)) updateRow(row.key, { type: next });
                      }}
                    >
                      {/*
                        A component saved with a type the app does not
                        recognise is offered as its own option, so opening
                        the form never silently rewrites it into something
                        else — and never drops it.
                      */}
                      {!isExamType(row.type) ? (
                        <option value={row.type}>{row.type}</option>
                      ) : null}
                      {EXAM_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {EXAM_TYPE_LABELS[type]}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="md:col-span-3">
                    <label className="flex flex-col gap-xs">
                      <span className="text-body-sm font-semibold text-ink">
                        Max marks
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={row.maxMarks}
                        onChange={(e) =>
                          updateRow(row.key, { maxMarks: Number(e.target.value) })
                        }
                        className="cb-input num"
                      />
                    </label>
                  </div>
                  <div className="md:col-span-3">
                    <label className="flex flex-col gap-xs">
                      <span className="text-body-sm font-semibold text-ink">
                        Passing marks
                        <span className="ml-1 font-normal text-muted">
                          (optional)
                        </span>
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={row.passingMarks ?? ''}
                        onChange={(e) =>
                          updateRow(row.key, {
                            passingMarks:
                              e.target.value === '' ? undefined : Number(e.target.value),
                          })
                        }
                        placeholder="—"
                        className="cb-input num"
                      />
                    </label>
                  </div>
                  <div className="flex items-center justify-end md:col-span-1">
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      aria-label={`Remove component ${index + 1}`}
                      title="Remove component"
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-strong hover:text-semantic-down"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </div>
              </li>
            ))}
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

      {error ? <FieldError message={error} /> : null}
    </form>
  );
}
