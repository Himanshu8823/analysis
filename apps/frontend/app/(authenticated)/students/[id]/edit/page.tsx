'use client';

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { StudentFormFields } from '@/components/forms/StudentFormFields';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/feedback/Spinner';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { useStudent, useUpdateStudent } from '@/hooks/useStudents';
import { useBranches } from '@/hooks/useBranches';
import { useSchemes } from '@/hooks/useSchemes';
import { useAcademicYears } from '@/hooks/useAcademic';

/**
 * Edit student — the edit flow.
 *
 * Shares `StudentFormFields` with the create page; the only difference is
 * that the record is fetched first and passed down as `initial`, so the
 * fields arrive pre-populated.
 */
export default function EditStudentPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const studentId = params?.id ?? null;

  const { data: student, isLoading, isError, refetch } = useStudent(studentId);
  const { data: branchesData } = useBranches();
  const { data: schemesData } = useSchemes();
  const { data: academicYears } = useAcademicYears();
  const { mutate: updateStudent, isPending: updating } = useUpdateStudent();

  const branches = branchesData ?? [];
  const schemes = schemesData ?? [];

  if (isLoading) {
    return (
      <section className="flex flex-col gap-6 md:gap-8">
        <div className="flex items-center gap-sm text-body-sm text-body">
          <Spinner size={16} /> Loading student…
        </div>
      </section>
    );
  }

  if (isError || !student) {
    return (
      <section className="flex flex-col gap-6 md:gap-8">
        <PageHeader title="Edit student" />
        <ErrorBanner message="Could not load this student." retry={() => refetch()} />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <PageHeader
        title={`Edit ${student.name}`}
        description="Update the student's details, then save your changes."
        actions={
          <Button variant="secondary" asChild className="w-full md:w-auto">
            <a href="/students">
              <ArrowLeft aria-hidden />
              Back to students
            </a>
          </Button>
        }
      />

      <div className="rounded-xl border border-hairline bg-card p-4 md:p-6">
        <StudentFormFields
          id="student-form"
          initial={student}
          branches={branches}
          schemes={schemes}
          academicYears={academicYears ?? []}
          onSubmit={(payload) => {
            updateStudent(
              { id: student.id, payload },
              { onSuccess: () => router.push('/students') },
            );
          }}
        />

        <div className="mt-6 flex flex-col-reverse gap-2 border-t border-hairline pt-4 md:flex-row md:items-center md:justify-end">
          <Button variant="secondary" asChild className="w-full md:w-auto">
            <a href="/students">Cancel</a>
          </Button>
          <Button
            type="submit"
            form="student-form"
            disabled={updating}
            className="w-full md:w-auto"
          >
            {updating ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>
    </section>
  );
}
