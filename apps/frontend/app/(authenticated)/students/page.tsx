'use client';

import { useMemo, useState } from 'react';
import { Plus, Upload, Trash2, Pencil } from 'lucide-react';
import { Modal } from '@/components/forms/Modal';
import { DataTable, type DataTableColumn } from '@/components/forms/DataTable';
import { FilterBar } from '@/components/forms/FilterBar';
import { Select } from '@/components/forms/Select';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { Spinner } from '@/components/feedback/Spinner';
import {
  useStudents,
  useCreateStudent,
  useUpdateStudent,
  useDeleteStudent,
  useImportStudents,
} from '@/hooks/useStudents';
import { useBranches } from '@/hooks/useBranches';
import { useSchemes } from '@/hooks/useSchemes';
import type { Student } from '@/lib/services/students.service';

export default function StudentsPage() {
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [schemeFilter, setSchemeFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);

  const { data: branchesData } = useBranches();
  const { data: schemesData } = useSchemes();

  const filters = useMemo(
    () => ({
      search: search || undefined,
      branchId: branchFilter || undefined,
      schemeId: schemeFilter || undefined,
    }),
    [search, branchFilter, schemeFilter],
  );

  const { data, isLoading, isError, refetch } = useStudents(filters);
  const { mutate: createStudent, isPending: creating } = useCreateStudent();
  const { mutate: updateStudent, isPending: updating } = useUpdateStudent();
  const { mutate: deleteStudent } = useDeleteStudent();
  const { mutate: importStudents, isPending: importing } = useImportStudents();

  const branches = branchesData?.data ?? [];
  const schemes = schemesData?.data ?? [];
  const rows = data?.data ?? [];

  const columns: DataTableColumn<Student>[] = [
    {
      key: 'rollNo',
      header: 'Roll No',
      render: (row) => <span className="num text-ink">{row.rollNo}</span>,
    },
    {
      key: 'name',
      header: 'Name',
      render: (row) => <span className="text-ink">{row.name}</span>,
    },
    {
      key: 'branch',
      header: 'Branch',
      render: (row) => (
        <span className="text-body-sm text-body">
          {branchName(branches, row.branchId)}
        </span>
      ),
    },
    {
      key: 'scheme',
      header: 'Scheme',
      render: (row) => schemeName(schemes, row.schemeId),
    },
    {
      key: 'year',
      header: 'Year / Sem',
      render: (row) => `Y${row.year} · S${row.semester}`,
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-xs">
          <button
            type="button"
            aria-label={`Edit ${row.name}`}
            onClick={() => setEditing(row)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface-strong hover:text-ink"
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label={`Delete ${row.name}`}
            onClick={() => {
              if (confirm(`Delete ${row.name}?`)) deleteStudent(row.id);
            }}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface-strong hover:text-semantic-down"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ),
    },
  ];

  return (
    <section className="space-y-lg">
      <header className="flex flex-col gap-xs">
        <span className="cb-badge">Students</span>
        <div className="flex flex-col items-start gap-sm md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-display text-title-lg text-ink md:text-display-sm">
              Student Records
            </h1>
            <p className="text-body-sm text-body">
              Browse, search, import, and edit student records.
            </p>
          </div>
          <div className="flex flex-col gap-xs md:flex-row">
            <ImportButton
              disabled={importing}
              onFile={(file) => importStudents(file)}
            />
            <button
              type="button"
              className="cb-btn-primary"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="mr-1 h-4 w-4" aria-hidden /> Add student
            </button>
          </div>
        </div>
      </header>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by roll no or name"
      >
        <select
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          className="cb-input md:w-44"
          aria-label="Filter by branch"
        >
          <option value="">All branches</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.code} · {branch.name}
            </option>
          ))}
        </select>
        <select
          value={schemeFilter}
          onChange={(e) => setSchemeFilter(e.target.value)}
          className="cb-input md:w-44"
          aria-label="Filter by scheme"
        >
          <option value="">All schemes</option>
          {schemes.map((scheme) => (
            <option key={scheme.id} value={scheme.id}>
              {scheme.code}
            </option>
          ))}
        </select>
      </FilterBar>

      {isError ? (
        <ErrorBanner message="Could not load students." retry={() => refetch()} />
      ) : null}

      {isLoading ? (
        <div className="flex items-center gap-sm text-body-sm text-body">
          <Spinner size={16} /> Loading students…
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          keyExtractor={(row) => row.id}
          emptyState={
            <EmptyState
              title="No students yet"
              description="Add students individually or upload a CSV/Excel file."
              action={
                <div className="flex flex-wrap justify-center gap-sm">
                  <button
                    type="button"
                    className="cb-btn-primary"
                    onClick={() => setCreateOpen(true)}
                  >
                    Add student
                  </button>
                  <ImportButton
                    disabled={importing}
                    onFile={(file) => importStudents(file)}
                  />
                </div>
              }
            />
          }
        />
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add student"
        size="md"
        footer={
          <>
            <button
              type="button"
              className="cb-btn-secondary w-full md:w-auto"
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-student-form"
              className="cb-btn-primary w-full md:w-auto"
              disabled={creating}
            >
              {creating ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <StudentForm
          id="create-student-form"
          branches={branches}
          schemes={schemes}
          onSubmit={(payload) => {
            createStudent(payload, {
              onSuccess: () => setCreateOpen(false),
            });
          }}
        />
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`Edit ${editing?.name ?? ''}`}
        size="md"
        footer={
          <>
            <button
              type="button"
              className="cb-btn-secondary w-full md:w-auto"
              onClick={() => setEditing(null)}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-student-form"
              className="cb-btn-primary w-full md:w-auto"
              disabled={updating}
            >
              {updating ? 'Saving…' : 'Save changes'}
            </button>
          </>
        }
      >
        {editing ? (
          <StudentForm
            id="edit-student-form"
            branches={branches}
            schemes={schemes}
            initial={editing}
            onSubmit={(payload) => {
              updateStudent(
                { id: editing.id, payload },
                { onSuccess: () => setEditing(null) },
              );
            }}
          />
        ) : null}
      </Modal>
    </section>
  );
}

function StudentForm({
  id,
  branches,
  schemes,
  initial,
  onSubmit,
}: {
  id: string;
  branches: Array<{ id: string; code: string; name: string }>;
  schemes: Array<{ id: string; code: string; name: string }>;
  initial?: Student;
  onSubmit: (payload: Omit<Student, 'id'>) => void;
}) {
  const [form, setForm] = useState<Omit<Student, 'id'>>(() =>
    initial
      ? {
          rollNo: initial.rollNo,
          name: initial.name,
          branchId: initial.branchId,
          schemeId: initial.schemeId,
          year: initial.year,
          semester: initial.semester,
          batchId: initial.batchId,
        }
      : {
          rollNo: '',
          name: '',
          branchId: branches[0]?.id ?? '',
          schemeId: schemes[0]?.id ?? '',
          year: 1,
          semester: 1,
        },
  );

  return (
    <form
      id={id}
      className="grid grid-cols-1 gap-base md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
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
            {scheme.code} · {scheme.name}
          </option>
        ))}
      </Select>
      <Select
        label="Year"
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

function ImportButton({
  disabled,
  onFile,
}: {
  disabled: boolean;
  onFile: (file: File) => void;
}) {
  return (
    <label className={`cb-btn-secondary w-full md:w-auto ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
      <Upload className="mr-1 h-4 w-4" aria-hidden /> {disabled ? 'Importing…' : 'Import CSV'}
      <input
        type="file"
        accept=".csv,.xlsx,.xls"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
      />
    </label>
  );
}

function branchName(
  branches: Array<{ id: string; code: string; name: string }>,
  id: string,
): string {
  const b = branches.find((branch) => branch.id === id);
  return b ? `${b.code} · ${b.name}` : '—';
}

function schemeName(
  schemes: Array<{ id: string; code: string; name: string }>,
  id: string,
): string {
  const scheme = schemes.find((s) => s.id === id);
  return scheme ? scheme.code : '—';
}