'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { SubjectFormFields } from '@/components/forms/SubjectFormFields';
import { Button } from '@/components/ui/button';
import { useCreateSubject } from '@/hooks/useSubjects';

/**
 * New subject — the create flow.
 *
 * A subject is the *template* the Exam Cell defines: the code, the name, the
 * credits, the marks ceiling and how the marks split into assessments. The
 * teacher fills in what each student scored against it later.
 *
 * The form is the same component the edit page uses; it is simply rendered
 * without an existing subject to pre-populate it.
 */
export default function NewSubjectPage() {
  const router = useRouter();
  const { mutate: createSubject, isPending: creating } = useCreateSubject();

  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <PageHeader
        title="New subject"
        description="Define a subject's identity and the assessment breakdown a teacher will fill in."
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
          id="new-subject-form"
          onSubmit={(payload) =>
            createSubject(payload, { onSuccess: () => router.push('/admin/subjects') })
          }
        />

        <div className="mt-6 flex flex-col-reverse gap-2 border-t border-hairline pt-4 md:flex-row md:items-center md:justify-end">
          <Button variant="secondary" asChild className="w-full md:w-auto">
            <a href="/admin/subjects">Cancel</a>
          </Button>
          <Button
            type="submit"
            form="new-subject-form"
            disabled={creating}
            className="w-full md:w-auto"
          >
            {creating ? 'Creating…' : 'Create subject'}
          </Button>
        </div>
      </div>
    </section>
  );
}
