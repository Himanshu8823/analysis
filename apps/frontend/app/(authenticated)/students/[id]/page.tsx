'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Archive,
  Award,
  BookOpen,
  CalendarRange,
  CheckCircle2,
  FileDown,
  FileSpreadsheet,
  IdCard,
  KeyRound,
  Pencil,
  Percent,
  User,
  XCircle,
} from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/feedback/Spinner';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { EmptyState } from '@/components/feedback/EmptyState';
import {
  DetailGrid,
  DetailRow,
  ProfileSection,
  StatusPill,
} from '@/components/students/ProfileSection';
import {
  useStudentProfile,
  useProvisionStudentLogin,
  useDeleteStudent,
} from '@/hooks/useStudents';
import { formatters } from '@/lib/utils/formatters';
import {
  bloodGroupLabel,
  examTypeLabel,
  examinationStatusLabel,
  feeCategoryLabel,
  genderLabel,
  guardianRelationLabel,
  reservedCategoryLabel,
  studentStatusLabel,
} from '@/lib/utils/student-labels';
import type {
  StudentSubjectMarksView,
} from '@/lib/services/students.service';

/**
 * The student profile.
 *
 * This is a *read* screen, not the edit form — the edit form lives at
 * `/students/[id]/edit` and this page links to it. What this screen shows
 * depends on who is asking, and the **server** decides that: a section the
 * caller may not read is absent from the payload, so the screen renders
 * what it was given and explains what it was not given.
 *
 * That is why the screen never asks the backend "may I see the national
 * id?" — it simply does not have it. A section that is missing is a
 * section the caller is not entitled to, and the notice says so in plain
 * language rather than leaving an unexplained gap.
 */
export default function StudentProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const studentId = params?.id ?? null;

  const { data, isLoading, isError, refetch } = useStudentProfile(studentId);
  const provision = useProvisionStudentLogin();
  const archive = useDeleteStudent();

  const [provisioned, setProvisioned] = useState<{
    email: string;
    temporaryPassword: string | null;
    created: boolean;
  } | null>(null);

  const actions = useMemo(() => new Set(data?.availableActions ?? []), [data]);

  if (isLoading) {
    return (
      <section className="flex flex-col gap-6 md:gap-8">
        <PageHeader title="Student profile" backLink={{ href: '/students', label: 'Back to students' }} />
        <div className="flex items-center gap-sm text-body-sm text-body">
          <Spinner size={16} /> Loading the student’s profile…
        </div>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className="flex flex-col gap-6 md:gap-8">
        <PageHeader title="Student profile" backLink={{ href: '/students', label: 'Back to students' }} />
        <ErrorBanner message="Could not load this student’s profile." retry={() => refetch()} />
      </section>
    );
  }

  const { identity } = data;

  const onProvision = () => {
    if (!studentId) return;
    provision.mutate(
      { id: studentId, email: identity.email ?? undefined },
      {
        onSuccess: (result) => {
          setProvisioned({
            email: result.email,
            temporaryPassword: result.temporaryPassword,
            created: result.created,
          });
        },
      },
    );
  };

  const onArchive = () => {
    if (!studentId) return;
    if (!confirm(`Archive ${identity.name}? Their record will be kept for the audit trail.`)) return;
    archive.mutate(studentId, {
      onSuccess: () => router.push('/students'),
    });
  };

  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <PageHeader
        eyebrow={`${identity.branchCode} · Semester ${identity.semester} · Year ${identity.currentYear}`}
        title={identity.name}
        description={`Roll number ${identity.rollNo} · ${identity.batchName} · ${identity.academicYear}`}
        backLink={{ href: '/students', label: 'Back to students' }}
        actions={
          <>
            {actions.has('edit') ? (
              <Button variant="secondary" asChild className="w-full md:w-auto">
                <Link href={`/students/${identity.id}/edit`}>
                  <Pencil aria-hidden />
                  Edit details
                </Link>
              </Button>
            ) : null}
            {actions.has('provision-login') ? (
              <Button
                variant="secondary"
                onClick={onProvision}
                disabled={provision.isPending}
                className="w-full md:w-auto"
              >
                <KeyRound aria-hidden />
                {provision.isPending ? 'Creating…' : 'Give a login'}
              </Button>
            ) : null}
            {actions.has('generate-report') ? (
              <Button variant="secondary" asChild className="w-full md:w-auto">
                <Link href={`/reports?studentId=${identity.id}`}>
                  <FileSpreadsheet aria-hidden />
                  Generate report
                </Link>
              </Button>
            ) : null}
            {actions.has('export-result') ? (
              <Button variant="secondary" asChild className="w-full md:w-auto">
                <Link href={`/reports?studentId=${identity.id}`}>
                  <FileDown aria-hidden />
                  Export result
                </Link>
              </Button>
            ) : null}
            {actions.has('archive') ? (
              <Button
                variant="secondary"
                onClick={onArchive}
                disabled={archive.isPending}
                className="w-full md:w-auto"
              >
                <Archive aria-hidden />
                Archive
              </Button>
            ) : null}
          </>
        }
      />

      {/* The temporary password, shown once. */}
      {provisioned ? (
        <article
          className="cb-surface-card border-primary p-base"
          aria-label="Login details"
        >
          <h2 className="font-display text-title-md text-ink">
            {provisioned.created ? 'The login has been created' : 'An existing login was linked'}
          </h2>
          <p className="mt-1 text-body-sm text-body">
            The login address is <span className="font-semibold text-ink">{provisioned.email}</span>.
            {provisioned.temporaryPassword
              ? ' Read the temporary password below to the student — it is shown only once and is not sent by email.'
              : ' This student already had an account, so no new password was created.'}
          </p>
          {provisioned.temporaryPassword ? (
            <p className="num mt-3 inline-flex rounded-sm bg-surface-strong px-3 py-2 text-title-sm text-ink">
              {provisioned.temporaryPassword}
            </p>
          ) : null}
        </article>
      ) : null}

      {/* The notice explaining what this caller may not see. */}
      {data.restrictedNotice ? (
        <article
          className="cb-surface-card border-hairline bg-surface-soft p-base"
          aria-label="Access notice"
        >
          <p className="text-body-sm text-body">{data.restrictedNotice}</p>
        </article>
      ) : null}

      {/* -------------------------------------------------------------------
          Identity and profile
      ------------------------------------------------------------------- */}
      <ProfileSection
        title="Identity and profile"
        description="Who this student is, and how to reach them."
      >
        <div className="flex flex-col gap-base md:flex-row md:items-start md:gap-lg">
          {/* The photograph, or the initials when there is none. */}
          <div className="flex shrink-0 items-center gap-sm">
            {identity.photoUrl ? (
              <img
                src={identity.photoUrl}
                alt=""
                className="size-16 rounded-full border border-hairline object-cover"
              />
            ) : (
              <span
                className="inline-flex size-16 items-center justify-center rounded-full bg-surface-strong font-display text-title-md text-body"
                aria-hidden
              >
                {identity.initials || '—'}
              </span>
            )}
            <div className="min-w-0 md:hidden">
              <p className="font-display text-title-md text-ink">{identity.name}</p>
              <p className="text-body-sm text-muted">Roll number {identity.rollNo}</p>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <DetailGrid columns={4}>
              <DetailRow label="Full name" value={identity.name} />
              <DetailRow label="Roll number" value={identity.rollNo} />
              <DetailRow label="Branch" value={`${identity.branchCode} · ${identity.branchName}`} />
              <DetailRow label="Scheme" value={identity.schemeName} />
              <DetailRow label="Batch" value={identity.batchName} />
              <DetailRow label="Current semester" value={`Semester ${identity.semester}`} />
              <DetailRow label="Year of study" value={`Year ${identity.currentYear}`} />
              <DetailRow label="Academic year" value={identity.academicYear} />
              <DetailRow
                label="Admission year"
                value={identity.admissionYear ? String(identity.admissionYear) : '—'}
              />
              <DetailRow label="Section" value={identity.section ?? '—'} />
              <DetailRow
                label="Date of birth"
                value={identity.dateOfBirth ? formatters.date(identity.dateOfBirth) : '—'}
              />
              <DetailRow label="Gender" value={genderLabel(identity.gender)} />
              <DetailRow label="Status" value={studentStatusLabel(identity.status)} />
            </DetailGrid>

            {identity.statusReason || identity.statusDate ? (
              <p className="mt-base text-body-sm text-body">
                {identity.statusReason ? identity.statusReason : 'Status changed'}
                {identity.statusDate
                  ? ` · ${formatters.date(identity.statusDate, 'long')}`
                  : ''}
              </p>
            ) : null}
          </div>
        </div>

        <hr className="my-base border-hairline" />

        <DetailGrid columns={3}>
          <DetailRow
            label="Phone"
            value={identity.phone ? <PhoneHint value={identity.phone} /> : '—'}
          />
          <DetailRow label="Email" value={identity.email ?? '—'} />
          <DetailRow label="Alternate email" value={identity.alternateEmail ?? '—'} />
          <DetailRow
            label="Address"
            value={
              identity.address
                ? [identity.address, identity.city, identity.state, identity.pincode]
                    .filter(Boolean)
                    .join(', ')
                : '—'
            }
            wide
          />
        </DetailGrid>

        <hr className="my-base border-hairline" />

        <DetailGrid columns={3}>
          <DetailRow
            label="Reserved category"
            value={reservedCategoryLabel(identity.reservedCategory)}
          />
          <DetailRow label="Fee category" value={feeCategoryLabel(identity.feeCategory)} />
          <DetailRow
            label="Scholarship"
            value={identity.scholarshipRecipient ? 'Holds a scholarship' : 'No scholarship'}
          />
          <DetailRow
            label="Login"
            value={identity.hasLogin ? 'A login has been given' : 'No login yet'}
          />
        </DetailGrid>

        {/*
          The sensitive identity block and the guardian block are rendered
          only when the payload carried them. The server decides — a field
          the caller may not read never arrives, so there is nothing here to
          hide.
        */}
        {identity.sensitive ? (
          <>
            <hr className="my-base border-hairline" />
            <h3 className="flex items-center gap-1.5 text-caption-strong uppercase tracking-wide text-muted">
              <IdCard className="size-3.5" aria-hidden />
              Identity document
            </h3>
            <div className="mt-base">
              <DetailGrid columns={2}>
                <DetailRow
                  label="National identity number"
                  value={identity.sensitive.nationalId ?? '—'}
                />
                <DetailRow
                  label="Blood group"
                  value={bloodGroupLabel(identity.sensitive.bloodGroup)}
                />
              </DetailGrid>
            </div>
          </>
        ) : null}

        {identity.guardians ? (
          <>
            <hr className="my-base border-hairline" />
            <h3 className="flex items-center gap-1.5 text-caption-strong uppercase tracking-wide text-muted">
              <User className="size-3.5" aria-hidden />
              Guardian
            </h3>
            <div className="mt-base flex flex-col gap-base lg:flex-row lg:gap-lg">
              {[identity.guardians.primary, identity.guardians.secondary]
                .filter(Boolean)
                .map((guardian, index) => (
                  <div key={index} className="min-w-0 flex-1">
                    <DetailGrid columns={2}>
                      <DetailRow label="Name" value={guardian!.name ?? '—'} />
                      <DetailRow
                        label="Relation"
                        value={guardianRelationLabel(guardian!.relation)}
                      />
                      <DetailRow label="Phone" value={guardian!.phone ?? '—'} />
                      <DetailRow label="Email" value={guardian!.email ?? '—'} />
                      <DetailRow label="Occupation" value={guardian!.occupation ?? '—'} />
                    </DetailGrid>
                  </div>
                ))}
              {identity.guardians.primary === null && identity.guardians.secondary === null ? (
                <p className="text-body-sm text-body">No guardian has been recorded yet.</p>
              ) : null}
            </div>
          </>
        ) : null}
      </ProfileSection>

      {/* -------------------------------------------------------------------
          Academic snapshot
      ------------------------------------------------------------------- */}
      {data.academic ? (
        <ProfileSection
          title="Academic snapshot"
          description={`Semester ${data.academic.semester} · ${data.academic.academicYear}`}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label="Aggregate"
              value={
                data.academic.aggregate === null
                  ? '—'
                  : formatters.percentage(data.academic.aggregate, 2)
              }
              helper={
                data.academic.grade ? `Grade ${data.academic.grade}` : 'Not yet evaluated'
              }
              icon={Percent}
            />
            <SummaryCard
              label="Result"
              value={resultLabel(data.academic.isPass, data.academic.isEvaluated)}
              helper={
                data.academic.failedSubjects?.length
                  ? `${data.academic.failedSubjects.length} subject${data.academic.failedSubjects.length === 1 ? '' : 's'} to clear`
                  : data.academic.isEvaluated
                    ? 'All subjects cleared'
                    : 'Marks are still being entered'
              }
              icon={data.academic.isPass ? CheckCircle2 : XCircle}
            />
            <SummaryCard
              label="Credits earned"
              value={`${data.academic.earnedCredits} / ${data.academic.totalCredits}`}
              helper="Credit points in this semester"
              icon={Award}
            />
            <SummaryCard
              label="Subjects"
              value={String(data.academic.subjects.length)}
              helper="Enrolled this semester"
              icon={BookOpen}
            />
          </div>

          {data.academic.subjects.length ? (
            <div className="mt-base overflow-x-auto">
              <table className="w-full text-body-sm">
                <thead className="bg-surface-soft">
                  <tr>
                    <th scope="col" className="px-base py-sm text-left font-semibold text-muted">
                      Subject
                    </th>
                    <th scope="col" className="px-base py-sm text-right font-semibold text-muted">
                      Credits
                    </th>
                    <th scope="col" className="px-base py-sm text-right font-semibold text-muted">
                      Maximum
                    </th>
                    <th scope="col" className="px-base py-sm text-right font-semibold text-muted">
                      Pass mark
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.academic.subjects.map((subject) => (
                    <tr
                      key={subject.subjectOfferingId}
                      className="border-t border-hairline first:border-t-0"
                    >
                      <td className="px-base py-sm">
                        <p className="font-semibold text-ink">{subject.subjectCode}</p>
                        <p className="text-caption text-muted">{subject.subjectName}</p>
                      </td>
                      <td className="num px-base py-sm text-right text-body">{subject.credits}</td>
                      <td className="num px-base py-sm text-right text-ink">{subject.maxMarks}</td>
                      <td className="num px-base py-sm text-right text-ink">
                        {subject.passingMarks}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-base text-body-sm text-body">
              No subjects have been placed in this semester yet.
            </p>
          )}

          {data.academic.failedSubjects?.length ? (
            <>
              <h3 className="mt-base text-caption-strong uppercase tracking-wide text-muted">
                Subjects to clear
              </h3>
              <ul className="mt-2 flex flex-col divide-y divide-hairline">
                {data.academic.failedSubjects.map((subject) => (
                  <li
                    key={subject.subjectCode}
                    className="flex flex-col gap-1 py-3 md:flex-row md:items-center md:justify-between md:gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-body-sm font-semibold text-ink">
                        {subject.subjectCode} — {subject.subjectName}
                      </p>
                      <p className="text-caption text-muted">{subject.reason}</p>
                    </div>
                    <StatusPill label="Not cleared" tone="down" />
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </ProfileSection>
      ) : null}

      {/* -------------------------------------------------------------------
          Result history
      ------------------------------------------------------------------- */}
      {data.resultHistory?.length ? (
        <ProfileSection
          title="Result history"
          description="Every semester this student has sat, and how it went."
        >
          <div className="overflow-x-auto">
            <table className="w-full text-body-sm">
              <thead className="bg-surface-soft">
                <tr>
                  <th scope="col" className="px-base py-sm text-left font-semibold text-muted">
                    Semester
                  </th>
                  <th scope="col" className="px-base py-sm text-left font-semibold text-muted">
                    Year
                  </th>
                  <th scope="col" className="px-base py-sm text-right font-semibold text-muted">
                    Total
                  </th>
                  <th scope="col" className="px-base py-sm text-right font-semibold text-muted">
                    Aggregate
                  </th>
                  <th scope="col" className="px-base py-sm text-right font-semibold text-muted">
                    Credits
                  </th>
                  <th scope="col" className="px-base py-sm text-left font-semibold text-muted">
                    Grade
                  </th>
                  <th scope="col" className="px-base py-sm text-left font-semibold text-muted">
                    Result
                  </th>
                  <th scope="col" className="px-base py-sm text-left font-semibold text-muted">
                    Examination
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.resultHistory.map((entry) => (
                  <tr
                    key={`${entry.academicYearId}-${entry.semester}`}
                    className="border-t border-hairline first:border-t-0"
                  >
                    <td className="px-base py-sm font-semibold text-ink">Semester {entry.semester}</td>
                    <td className="px-base py-sm text-body">{entry.academicYear}</td>
                    <td className="num px-base py-sm text-right text-ink">
                      {entry.maxTotalMarks > 0
                        ? formatters.marks(entry.totalMarks, entry.maxTotalMarks)
                        : '—'}
                    </td>
                    <td className="num px-base py-sm text-right text-ink">
                      {entry.aggregate === null ? '—' : formatters.percentage(entry.aggregate, 2)}
                    </td>
                    <td className="num px-base py-sm text-right text-body">
                      {entry.creditsEarned} / {entry.totalCredits}
                    </td>
                    <td className="px-base py-sm text-body">{entry.grade ?? '—'}</td>
                    <td className="px-base py-sm">
                      <StatusPill
                        label={resultLabel(entry.isPass, entry.maxTotalMarks > 0)}
                        tone={
                          entry.maxTotalMarks === 0
                            ? 'neutral'
                            : entry.isPass
                              ? 'up'
                              : 'down'
                        }
                      />
                    </td>
                    <td className="px-base py-sm text-body">
                      {examinationStatusLabel(entry.examinationStatus)}
                      {entry.resultPublishedAt ? (
                        <span className="block text-caption text-muted">
                          Declared {formatters.date(entry.resultPublishedAt)}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ProfileSection>
      ) : null}

      {/* -------------------------------------------------------------------
          Marks history
      ------------------------------------------------------------------- */}
      {data.marksHistory?.length ? (
        <ProfileSection
          title="Marks history"
          description="Every subject, every component, for every semester."
        >
          <div className="flex flex-col gap-lg">
            {data.marksHistory.map((group) => (
              <div key={`${group.academicYearId}-${group.semester}`}>
                <h3 className="flex items-center gap-2 text-title-sm text-ink">
                  <CalendarRange className="size-4 text-muted" aria-hidden />
                  Semester {group.semester} · {group.academicYear}
                </h3>

                <div className="mt-2 flex flex-col gap-3">
                  {group.subjects.map((subject) => (
                    <SubjectMarksCard key={subject.subjectOfferingId} subject={subject} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ProfileSection>
      ) : null}

      {/* -------------------------------------------------------------------
          Documents
      ------------------------------------------------------------------- */}
      {data.documents ? (
        <ProfileSection title="Documents and records" description="What is on file for this student.">
          {data.documents.length === 0 ? (
            <EmptyState
              variant="plain"
              title="Nothing on file yet"
              description="Uploaded mark statements and generated reports will appear here."
            />
          ) : (
            <ul className="flex flex-col divide-y divide-hairline">
              {data.documents.map((document) => (
                <li
                  key={`${document.kind}-${document.id}`}
                  className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 md:flex-row md:items-center md:justify-between md:gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-body-sm font-semibold text-ink">{document.title}</p>
                    <p className="text-caption text-muted">
                      {document.kind} · {formatters.date(document.createdAt)}
                    </p>
                  </div>
                  <StatusPill label={document.status} tone="neutral" />
                </li>
              ))}
            </ul>
          )}
        </ProfileSection>
      ) : null}

      {/* -------------------------------------------------------------------
          Activity
      ------------------------------------------------------------------- */}
      {data.activity ? (
        <ProfileSection
          title="Activity"
          description="Who changed this student’s record, and when."
        >
          {data.activity.length === 0 ? (
            <EmptyState
              variant="plain"
              title="No changes recorded yet"
              description="Every edit to this student’s record will be listed here."
            />
          ) : (
            <ul className="flex flex-col divide-y divide-hairline">
              {data.activity.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 md:flex-row md:items-center md:justify-between md:gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-body-sm font-semibold text-ink">{entry.action}</p>
                    <p className="text-caption text-muted">
                      {entry.actorName ?? 'The system'}
                      {entry.details ? ` · ${entry.details}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 text-caption text-muted">
                    {formatters.date(entry.createdAt, 'long')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ProfileSection>
      ) : null}
    </section>
  );
}

/**
 * One subject's marks, with its component breakdown.
 */
function SubjectMarksCard({ subject }: { subject: StudentSubjectMarksView }) {
  return (
    <article className="rounded-md border border-hairline">
      <header className="flex flex-col gap-1 border-b border-hairline px-base py-sm md:flex-row md:items-center md:justify-between md:gap-4">
        <div className="min-w-0">
          <p className="text-body-sm font-semibold text-ink">
            {subject.subjectCode} — {subject.subjectName}
          </p>
          <p className="text-caption text-muted">
            Maximum {subject.maxMarks} · Pass mark {subject.passingMarks} · {subject.credits} credits
          </p>
        </div>
        <div className="flex items-center gap-2">
          {subject.percentage !== null ? (
            <span className="num text-body-sm font-semibold text-ink">
              {formatters.marks(subject.totalObtained, subject.totalMax)} ·{' '}
              {formatters.percentage(subject.percentage, 1)}
            </span>
          ) : null}
          {subject.isPass !== null ? (
            <StatusPill
              label={subject.isPass ? 'Cleared' : 'Not cleared'}
              tone={subject.isPass ? 'up' : 'down'}
            />
          ) : null}
        </div>
      </header>

      <ul className="flex flex-col divide-y divide-hairline">
        {subject.components.map((component, index) => (
          <li
            key={`${component.examType}-${index}`}
            className="flex flex-col gap-1 px-base py-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <span className="text-body-sm text-body">
              {examTypeLabel(component.examType)}
              {component.remarks ? (
                <span className="block text-caption text-muted">{component.remarks}</span>
              ) : null}
            </span>
            <span className="flex items-center gap-2">
              <span className="num text-body-sm text-ink">
                {component.isAbsent
                  ? 'Absent'
                  : formatters.marks(component.marksObtained, component.maxMarks)}
              </span>
              {component.isWithheld ? (
                <StatusPill label="Withheld" tone="neutral" />
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      {subject.reason ? (
        <p className="border-t border-hairline px-base py-sm text-caption text-body">
          {subject.reason}
        </p>
      ) : null}
    </article>
  );
}

/**
 * One summary figure.
 */
function SummaryCard({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: typeof Percent;
}) {
  return (
    <article className="flex flex-col gap-sm" aria-label={`${label}: ${value}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-caption uppercase tracking-wide text-muted">{label}</span>
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-strong">
          <Icon className="size-4 text-body" aria-hidden />
        </span>
      </div>
      <p className="num font-display text-display-sm text-ink">{value}</p>
      <p className="text-caption text-muted">{helper}</p>
    </article>
  );
}

/**
 * The result of a semester, in words.
 *
 * A semester with no marks is neither a pass nor a fail — it is pending —
 * and saying "Fail" for a half-marked class would be wrong.
 */
function resultLabel(isPass: boolean | null, isEvaluated: boolean): string {
  if (!isEvaluated) return 'Not yet evaluated';
  if (isPass === null) return 'Not yet evaluated';
  return isPass ? 'Pass' : 'Fail';
}

/**
 * A phone number, shown as a link on devices that can call it.
 */
function PhoneHint({ value }: { value: string }) {
  return (
    <a href={`tel:${value}`} className="text-primary hover:underline">
      {value}
    </a>
  );
}
