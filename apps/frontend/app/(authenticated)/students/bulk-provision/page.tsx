'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Users } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/forms/Select';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useBranches } from '@/hooks/useBranches';
import { useSchemes } from '@/hooks/useSchemes';
import { useAcademicYears, useRunningYear } from '@/hooks/useAcademic';
import { useBulkProvisionStudentLogins } from '@/hooks/useStudents';
import { ALL_SEMESTERS } from '@/lib/academic';
import type { BulkProvisionResult } from '@/lib/services/students.service';

/**
 * The bulk login-provisioning screen.
 *
 * The exam cell adds a whole class of students and then has to give each
 * one a login. Doing that one at a time is a hundred round trips and a
 * hundred chances to make a mistake; this screen does it in one run and
 * reports exactly what happened.
 *
 * The temporary passwords come back with the result and are shown **once**.
 * They are never emailed and never stored in plaintext, so the clerk has to
 * read them out — which is why the result panel is explicit about that.
 */
export default function BulkProvisionPage() {
  const router = useRouter();

  const { data: branchesData } = useBranches();
  const { data: schemesData } = useSchemes();
  const { data: academicYears } = useAcademicYears();
  const runningYear = useRunningYear();

  const [branchId, setBranchId] = useState('');
  const [semester, setSemester] = useState('1');
  const [schemeId, setSchemeId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [skipMissingEmail, setSkipMissingEmail] = useState(true);
  const [result, setResult] = useState<BulkProvisionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const branches = branchesData ?? [];
  const schemes = schemesData ?? [];
  const years = academicYears ?? [];

  /**
   * The running academic year is the sensible default: a clerk asking for
   * "this class's logins" almost always means the class that is running
   * now.
   *
   * "Running" is decided by the calendar's **dates**, not by a flag — the
   * same rule the backend uses to decide what to report on, so the screen
   * and the report agree about which year is current.
   */
  const activeYear = runningYear.year ?? years[0];

  const effectiveYearId = academicYearId || activeYear?.id || '';
  const effectiveSchemeId = schemeId || schemes[0]?.id || '';
  const effectiveBranchId = branchId || branches[0]?.id || '';

  const ready = Boolean(effectiveBranchId && effectiveSchemeId && effectiveYearId);

  const provision = useBulkProvisionStudentLogins();

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setResult(null);

    if (!ready) {
      setError('Choose the branch, scheme, semester and academic year of the class.');
      return;
    }

    provision.mutate(
      {
        branchId: effectiveBranchId,
        schemeId: effectiveSchemeId,
        semester: Number(semester),
        academicYearId: effectiveYearId,
        skipMissingEmail,
      },
      {
        onSuccess: (data) => setResult(data),
        onError: (err) => {
          setError(
            err instanceof Error ? err.message : 'The logins could not be created.'
          );
        },
      },
    );
  };

  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <PageHeader
        eyebrow="Students"
        title="Give a class its logins"
        description="Create a login for every student in a class, in one run. The temporary passwords are shown once — read them out to the students."
        backLink={{ href: '/students', label: 'Back to students' }}
      />

      <form
        onSubmit={onSubmit}
        className="cb-surface-card grid grid-cols-1 gap-base p-base md:grid-cols-2"
      >
        <Select
          label="Branch"
          value={effectiveBranchId}
          onChange={(e) => setBranchId(e.target.value)}
        >
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.code} · {branch.name}
            </option>
          ))}
        </Select>

        <Select
          label="Semester"
          value={semester}
          onChange={(e) => setSemester(e.target.value)}
        >
          {ALL_SEMESTERS.map((n) => (
            <option key={n} value={n}>
              Semester {n}
            </option>
          ))}
        </Select>

        <Select
          label="Scheme"
          value={effectiveSchemeId}
          onChange={(e) => setSchemeId(e.target.value)}
        >
          {schemes.map((scheme) => (
            <option key={scheme.id} value={scheme.id}>
              {scheme.name}
            </option>
          ))}
        </Select>

        <Select
          label="Academic year"
          value={effectiveYearId}
          onChange={(e) => setAcademicYearId(e.target.value)}
        >
          {years.map((year) => (
            <option key={year.id} value={year.id}>
              {year.year}
              {runningYear.year?.id === year.id ? ' (running now)' : ''}
            </option>
          ))}
        </Select>

        <label className="flex items-start gap-2 md:col-span-2">
          <input
            type="checkbox"
            checked={skipMissingEmail}
            onChange={(e) => setSkipMissingEmail(e.target.checked)}
            className="mt-1 size-4 rounded-xs border-hairline"
          />
          <span className="text-body-sm text-body">
            Skip students whose record has no email address, and list them
            afterwards, rather than stopping at the first one.
          </span>
        </label>

        <div className="md:col-span-2">
          {error ? <ErrorBanner message={error} /> : null}
        </div>

        <div className="flex flex-col gap-2 md:col-span-2 md:flex-row md:justify-end">
          <Button
            type="submit"
            disabled={!ready || provision.isPending}
            className="w-full md:w-auto"
          >
            <KeyRound aria-hidden />
            {provision.isPending ? 'Creating logins…' : 'Create the logins'}
          </Button>
        </div>
      </form>

      {result ? (
        <article className="cb-surface-card overflow-hidden rounded-md" aria-label="Run result">
          <header className="border-b border-hairline px-base py-base">
            <h2 className="font-display text-title-md text-ink">The run finished</h2>
            <p className="mt-1 text-body-sm text-body">
              {result.created} login{result.created === 1 ? '' : 's'} created,{' '}
              {result.linked} existing account{result.linked === 1 ? '' : 's'} linked,{' '}
              {result.skipped} skipped and {result.failures.length} failed.
            </p>
          </header>

          <div className="p-base">
            {result.accounts.length === 0 && result.failures.length === 0 ? (
              <EmptyState
                variant="plain"
                title="Nothing to do"
                description="Every student in that class already had a login."
                icon={<Users aria-hidden />}
              />
            ) : null}

            {result.accounts.length ? (
              <>
                <h3 className="text-caption-strong uppercase tracking-wide text-muted">
                  Temporary passwords
                </h3>
                <p className="mt-1 text-caption text-muted">
                  Shown once. Read each one out to the student — it is not
                  emailed and cannot be shown again.
                </p>
                <ul className="mt-2 flex flex-col divide-y divide-hairline">
                  {result.accounts.map((account) => (
                    <li
                      key={account.studentId}
                      className="flex flex-col gap-1 py-3 first:pt-0 md:flex-row md:items-center md:justify-between md:gap-4"
                    >
                      <div className="min-w-0">
                        <p className="text-body-sm font-semibold text-ink">
                          {account.studentName} · {account.rollNo}
                        </p>
                        <p className="text-caption text-muted">{account.email}</p>
                      </div>
                      <span className="num shrink-0 rounded-sm bg-surface-strong px-3 py-2 text-body-sm text-ink">
                        {account.temporaryPassword ?? 'Existing account'}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {result.failures.length ? (
              <>
                <h3 className="mt-base text-caption-strong uppercase tracking-wide text-muted">
                  Students that could not be given a login
                </h3>
                <ul className="mt-2 flex flex-col divide-y divide-hairline">
                  {result.failures.map((failure) => (
                    <li key={failure.studentId} className="py-3 first:pt-0 last:pb-0">
                      <p className="text-body-sm font-semibold text-ink">{failure.rollNo}</p>
                      <p className="text-caption text-muted">{failure.reason}</p>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        </article>
      ) : null}

      <div className="flex justify-end">
        <Button variant="secondary" onClick={() => router.push('/students')}>
          Back to students
        </Button>
      </div>
    </section>
  );
}
