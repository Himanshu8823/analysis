'use client';

import { useRouter } from 'next/navigation';

import { PageHeader } from '@/components/layout/PageHeader';
import { SubjectOfferingFields } from '@/components/forms/SubjectOfferingFields';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/feedback/Spinner';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { useBranches } from '@/hooks/useBranches';
import { useSchemes } from '@/hooks/useSchemes';
import { useAcademicYears } from '@/hooks/useAcademic';
import { useSubjects, useCreateSubjectOffering } from '@/hooks/useSubjects';

/**
 * Offer a subject to a class — the create flow for an offering.
 *
 * A subject is a catalogue entry; an offering says "this subject is taught to
 * this branch, in this semester, under this scheme, in this academic year".
 * The same subject can be offered many times over — that is why the two are
 * separate records.
 */
export default function NewSubjectOfferingPage() {
  const router = useRouter();
  const { data: branchesData } = useBranches();
  const { data: schemesData } = useSchemes();
  const { data: academicYears } = useAcademicYears();
  const { data: subjects, isLoading, isError, refetch } = useSubjects();
  const { mutate: createOffering, isPending: creating } = useCreateSubjectOffering();

  const branches = branchesData ?? [];
  const schemes = schemesData ?? [];
  const subjectList = subjects ?? [];

  if (isLoading) {
    return (
      <section className="flex flex-col gap-6 md:gap-8">
        <div className="flex items-center gap-sm text-body-sm text-body">
          <Spinner size={16} /> Loading subjects…
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="flex flex-col gap-6 md:gap-8">
        <PageHeader title="Offer a subject" backLink={{ href: '/admin/subjects', label: 'Back to subjects' }} />
        <ErrorBanner message="Could not load the subject catalogue." retry={() => refetch()} />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <PageHeader
        title="Offer a subject"
        description="Assign a subject to a branch and semester — the class structure the teacher fills in."
        backLink={{ href: '/admin/subjects', label: 'Back to subjects' }}
      />

      <div className="rounded-xl border border-hairline bg-card p-4 md:p-6">
        {/*
          The subject picker is a plain select rather than a custom dropdown:
          the catalogue is a short list of codes, and a native select is
          keyboard- and screen-reader-native without any extra machinery.
        */}
        <SubjectOfferingFields
          id="new-offering-form"
          branches={branches}
          schemes={schemes}
          academicYears={academicYears ?? []}
          subjects={subjectList}
          onSubmit={(payload) =>
            createOffering(payload, {
              onSuccess: () => router.push('/admin/subjects'),
            })
          }
        />

        <div className="mt-6 flex flex-col-reverse gap-2 border-t border-hairline pt-4 md:flex-row md:items-center md:justify-end">
          <Button variant="secondary" asChild className="w-full md:w-auto">
            <a href="/admin/subjects">Cancel</a>
          </Button>
          <Button
            type="submit"
            form="new-offering-form"
            disabled={creating || subjectList.length === 0}
            className="w-full md:w-auto"
          >
            {creating ? 'Saving…' : 'Offer subject'}
          </Button>
        </div>
      </div>
    </section>
  );
}
