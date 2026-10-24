'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { StudentFormFields } from '@/components/forms/StudentFormFields';
import { Button } from '@/components/ui/button';
import { useCreateStudent } from '@/hooks/useStudents';
import { useBranches } from '@/hooks/useBranches';
import { useSchemes } from '@/hooks/useSchemes';
import { useAcademicYears } from '@/hooks/useAcademic';

/**
 * Add student — the create flow.
 *
 * The list page links here; on a successful save the router returns to the
 * list so the new student is visible in context.
 */
export default function NewStudentPage() {
  const router = useRouter();
  const { data: branchesData } = useBranches();
  const { data: schemesData } = useSchemes();
  const { data: academicYears } = useAcademicYears();
  const { mutate: createStudent, isPending: creating } = useCreateStudent();

  const branches = branchesData ?? [];
  const schemes = schemesData ?? [];

  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <PageHeader
        title="Add student"
        description="Fill in the student's details, then save to add them to the list."
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
          branches={branches}
          schemes={schemes}
          academicYears={academicYears ?? []}
          onSubmit={(payload) => {
            createStudent(payload, {
              onSuccess: () => router.push('/students'),
            });
          }}
        />

        <div className="mt-6 flex flex-col-reverse gap-2 border-t border-hairline pt-4 md:flex-row md:items-center md:justify-end">
          <Button variant="secondary" asChild className="w-full md:w-auto">
            <a href="/students">Cancel</a>
          </Button>
          <Button
            type="submit"
            form="student-form"
            disabled={creating}
            className="w-full md:w-auto"
          >
            {creating ? 'Saving…' : 'Save student'}
          </Button>
        </div>
      </div>
    </section>
  );
}
