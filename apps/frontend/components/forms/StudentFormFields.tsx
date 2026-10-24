'use client';

import { useState } from 'react';

import { Select } from '@/components/forms/Select';
import { useBatches } from '@/hooks/useAcademic';
import type { Student } from '@/lib/services/students.service';

interface StudentFormFieldsProps {
  /** DOM id of the form element, so a save button can target it. */
  id: string;
  /** Prefilled values when editing; omitted when creating. */
  initial?: Student;
  branches: Array<{ id: string; code: string; name: string }>;
  schemes: Array<{ id: string; name: string }>;
  academicYears: Array<{ id: string; year: string; isActive: boolean }>;
  onSubmit: (payload: Omit<Student, 'id'>) => void;
}

/**
 * StudentFormFields — the shared field set for creating and editing a
 * student.
 *
 * One component serves both the "new student" and "edit student" pages:
 * the create page renders it with no `initial`, the edit page renders it
 * with the fetched record. The two flows therefore can never drift apart —
 * a field added here appears on both.
 */
export function StudentFormFields({
  id,
  initial,
  branches,
  schemes,
  academicYears,
  onSubmit,
}: StudentFormFieldsProps) {
  const activeYear = academicYears.find((y) => y.isActive) ?? academicYears[0];

  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<Omit<Student, 'id'>>(() =>
    initial
      ? {
          rollNo: initial.rollNo,
          name: initial.name,
          branchId: initial.branchId,
          schemeId: initial.schemeId,
          currentYear: initial.currentYear,
          semester: initial.semester,
          batchId: initial.batchId,
          academicYearId: initial.academicYearId,
          isActive: initial.isActive ?? true,
        }
      : {
          rollNo: '',
          name: '',
          branchId: branches[0]?.id ?? '',
          schemeId: schemes[0]?.id ?? '',
          currentYear: 1,
          semester: 1,
          batchId: '',
          academicYearId: activeYear?.id ?? '',
          isActive: true,
        },
  );

  /**
   * A batch records the year a student was admitted, while `academicYearId`
   * is the year the student is currently in. They are different years, so
   * filtering the batches by the current academic year would hide the very
   * batch the student belongs to. Every batch is listed instead.
   */
  const { data: batchData } = useBatches();
  const batches = batchData ?? [];

  return (
    <form
      id={id}
      onSubmit={(e) => {
        e.preventDefault();
        // A custom dropdown is a button, not a select, so the browser's own
        // required-validation does not fire for it. The batch is checked here
        // instead — it is the one field the server will reject.
        if (!form.batchId) {
          setError('Select a batch before saving.');
          return;
        }
        setError(null);
        onSubmit(form);
      }}
      className="grid grid-cols-1 gap-base md:grid-cols-2"
    >
      <label className="flex flex-col gap-xs">
        <span className="text-body-sm font-semibold text-ink">Roll number</span>
        <input
          required
          value={form.rollNo}
          onChange={(e) => setForm({ ...form, rollNo: e.target.value.toUpperCase() })}
          className="cb-input"
        />
      </label>
      <label className="flex flex-col gap-xs">
        <span className="text-body-sm font-semibold text-ink">Full name</span>
        <input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="cb-input"
        />
      </label>
      <Select
        label="Branch"
        value={form.branchId}
        onChange={(e) => setForm({ ...form, branchId: e.target.value })}
      >
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.code} · {branch.name}
          </option>
        ))}
      </Select>
      <Select
        label="Scheme"
        value={form.schemeId}
        onChange={(e) => setForm({ ...form, schemeId: e.target.value })}
      >
        {schemes.map((scheme) => (
          <option key={scheme.id} value={scheme.id}>
            {scheme.name}
          </option>
        ))}
      </Select>
      <Select
        label="Academic year"
        value={form.academicYearId}
        onChange={(e) => setForm({ ...form, academicYearId: e.target.value })}
      >
        {academicYears.map((year) => (
          <option key={year.id} value={year.id}>
            {year.year}
          </option>
        ))}
      </Select>
      <Select
        label="Batch"
        required
        error={error ?? undefined}
        value={form.batchId}
        onChange={(e) => {
          setError(null);
          setForm({ ...form, batchId: e.target.value });
        }}
      >
        <option value="">Select a batch</option>
        {batches.map((batch) => (
          <option key={batch.id} value={batch.id}>
            {batch.name}
          </option>
        ))}
      </Select>
      <Select
        label="Year"
        value={String(form.currentYear)}
        onChange={(e) => setForm({ ...form, currentYear: Number(e.target.value) })}
      >
        {[1, 2, 3, 4].map((n) => (
          <option key={n} value={n}>
            Year {n}
          </option>
        ))}
      </Select>
      <Select
        label="Semester"
        value={String(form.semester)}
        onChange={(e) => setForm({ ...form, semester: Number(e.target.value) })}
      >
        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
          <option key={n} value={n}>
            Semester {n}
          </option>
        ))}
      </Select>
    </form>
  );
}
