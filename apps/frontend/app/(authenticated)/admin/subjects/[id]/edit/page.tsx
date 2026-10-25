'use client';

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { SubjectFormFields } from '@/components/forms/SubjectFormFields';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/feedback/Spinner';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { useSubject, useUpdateSubject } from '@/hooks/useSubjects';

/**
 * Edit subject — the edit flow.
 *
 * Shares `SubjectFormFields` with the create page; the only difference is
 * that the record is fetched first and passed down as `initial`, so the
 * fields arrive pre-populated.
 */
export default function EditSubjectPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const subjectId = params?.id ?? null;

  const { data: subject, isLoading, isError, refetch } = useSubject(subjectId);
  const { mutate: updateSubject, isPending: updating } = useUpdateSubject();

  if (isLoading) {
    return (
      <section className="flex flex-col gap-6 md:gap-8">
        <div className="flex items-center gap-sm text-body-sm text-body">
          <Spinner size={16} /> Loading subject…
        </div>
      </section>
    );
  }

  if (isError || !subject) {
    return (
      <section className="flex flex-col gap-6 md:gap-8">
        <PageHeader title="Edit subject" />
        <ErrorBanner message="Could not load this subject." retry={() => refetch()} />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <PageHeader
        title={`Edit ${subject.code}`}
        description="Update the subject's details and assessment breakdown, then save."
        actions={
          <Button variant="secondary" asChild className="w-full md:w-auto">
            <a href="/admin/subjects">
              <ArrowLeft aria-hidden />
              Back to subjects
            </a>
          </Button>
        }
      />

      <div className="rounded-xl border border-hairline bg-card p-4 md:p-6">
        <SubjectFormFields
          id="edit-subject-form"
          initial={subject}
          onSubmit={(payload) =>
            updateSubject(
              { id: subject.id, payload },
              { onSuccess: () => router.push('/admin/subjects') },
            )
          }
        />

        <div className="mt-6 flex flex-col-reverse gap-2 border-t border-hairline pt-4 md:flex-row md:items-center md:justify-end">
          <Button variant="secondary" asChild className="w-full md:w-auto">
            <a href="/admin/subjects">Cancel</a>
          </Button>
          <Button
            type="submit"
            form="edit-subject-form"
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
