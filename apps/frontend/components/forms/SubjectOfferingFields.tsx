'use client';

import { useEffect, useState } from 'react';

import { Select } from '@/components/forms/Select';
import { FieldError } from '@/components/feedback/FieldError';
import type { SubjectOfferingPayload } from '@/lib/services/subjects.service';

interface SubjectOfferingFieldsProps {
  /** DOM id of the `<form>` so an external save button can target it. */
  id: string;
  branches: Array<{ id: string; code: string; name: string }>;
  schemes: Array<{ id: string; name: string }>;
  academicYears: Array<{ id: string; year: string; isActive: boolean }>;
  /** The subjects that can be offered. */
  subjects: Array<{ id: string; code: string; name: string }>;
  /** Pre-populated values when editing an existing offering. */
  initial?: SubjectOfferingPayload;
  onSubmit: (payload: SubjectOfferingPayload) => void;
}

/**
 * SubjectOfferingFields — the placement half of a subject.
 *
 * A subject is a catalogue entry; an offering says "this subject is taught to
 * this branch, in this semester, under this scheme, in this academic year".
 * The two are separate records because the same subject is offered in more
 * than one semester and more than one branch.
 */
export function SubjectOfferingFields({
  id,
  branches,
  schemes,
  academicYears,
  subjects,
  initial,
  onSubmit,
}: SubjectOfferingFieldsProps) {
  const activeYear = academicYears.find((y) => y.isActive) ?? academicYears[0];

  const [form, setForm] = useState<SubjectOfferingPayload>(() => ({
    subjectId: initial?.subjectId ?? subjects[0]?.id ?? '',
    branchId: initial?.branchId ?? branches[0]?.id ?? '',
    semester: initial?.semester ?? 1,
    schemeId: initial?.schemeId ?? schemes[0]?.id ?? '',
    year: initial?.year ?? 1,
    academicYearId: initial?.academicYearId ?? activeYear?.id ?? '',
  }));
  const [error, setError] = useState<string | null>(null);

  /**
   * Fills in the reference lists once they arrive.
   *
   * The branches, schemes, subjects and academic years are fetched
   * asynchronously, so the initial state is empty and the dropdowns would
   * otherwise open with nothing selected. Only *empty* fields are filled —
   * a value the user has chosen is never overwritten.
   */
  useEffect(() => {
    setForm((current) => ({
      ...current,
      subjectId: current.subjectId || subjects[0]?.id || '',
      branchId: current.branchId || branches[0]?.id || '',
      schemeId: current.schemeId || schemes[0]?.id || '',
      academicYearId: current.academicYearId || activeYear?.id || '',
    }));
  }, [subjects, branches, schemes, academicYears, activeYear]);

  return (
    <form
      id={id}
      className="grid grid-cols-1 gap-base md:grid-cols-2 lg:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        if (!form.subjectId) {
          setError('Select a subject before saving.');
          return;
        }
        if (!form.branchId) {
          setError('Select a branch before saving.');
          return;
        }
        if (!form.schemeId) {
          setError('Select a scheme before saving.');
          return;
        }
        if (!form.academicYearId) {
          setError('Select an academic year before saving.');
          return;
        }
        onSubmit(form);
      }}
    >
      <Select
        label="Subject"
        required
        value={form.subjectId}
        onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
      >
        <option value="">Select a subject</option>
        {subjects.map((subject) => (
          <option key={subject.id} value={subject.id}>
            {subject.code} · {subject.name}
          </option>
        ))}
      </Select>
      <Select
        label="Branch"
        required
        value={form.branchId}
        onChange={(e) => setForm({ ...form, branchId: e.target.value })}
      >
        <option value="">Select a branch</option>
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.code} · {branch.name}
          </option>
        ))}
      </Select>
      <Select
        label="Semester"
        required
        value={String(form.semester)}
        onChange={(e) => setForm({ ...form, semester: Number(e.target.value) })}
      >
        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
          <option key={n} value={n}>
            Semester {n}
          </option>
        ))}
      </Select>
      <Select
        label="Scheme"
        required
        value={form.schemeId}
        onChange={(e) => setForm({ ...form, schemeId: e.target.value })}
      >
        <option value="">Select a scheme</option>
        {schemes.map((scheme) => (
          <option key={scheme.id} value={scheme.id}>
            {scheme.name}
          </option>
        ))}
      </Select>
      <Select
        label="Curriculum year"
        required
        value={String(form.year)}
        onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
      >
        {[1, 2, 3, 4].map((n) => (
          <option key={n} value={n}>
            Year {n}
          </option>
        ))}
      </Select>
      <Select
        label="Academic year"
        required
        value={form.academicYearId}
        onChange={(e) => setForm({ ...form, academicYearId: e.target.value })}
      >
        <option value="">Select an academic year</option>
        {academicYears.map((year) => (
          <option key={year.id} value={year.id}>
            {year.year}
          </option>
        ))}
      </Select>
      {error ? (
        <div className="md:col-span-2 lg:col-span-3">
          <FieldError message={error} />
        </div>
      ) : null}
    </form>
  );
}
