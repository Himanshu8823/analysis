'use client';

import { useParams, useRouter } from 'next/navigation';

import { PageHeader } from '@/components/layout/PageHeader';
import { SchemeFormFields } from '@/components/forms/SchemeFormFields';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/feedback/Spinner';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { useScheme, useUpdateScheme } from '@/hooks/useSchemes';

/**
 * Edit scheme — the edit flow.
 *
 * The list page links here. The form is the same component the create page
 * uses; it is simply pre-populated with the scheme being edited.
 */
export default function EditSchemePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const schemeId = params?.id ?? null;

  const { data: scheme, isLoading, isError, refetch } = useScheme(schemeId);
  const { mutate: updateScheme, isPending: updating } = useUpdateScheme();

  if (isLoading) {
    return (
      <section className="flex flex-col gap-6 md:gap-8">
        <div className="flex items-center gap-sm text-body-sm text-body">
          <Spinner size={16} /> Loading scheme…
        </div>
      </section>
    );
  }

  if (isError || !scheme) {
    return (
      <section className="flex flex-col gap-6 md:gap-8">
        <PageHeader title="Edit scheme" backLink={{ href: '/admin/schemes', label: 'Back to schemes' }} />
        <ErrorBanner message="Could not load this scheme." retry={() => refetch()} />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <PageHeader
        title={`Edit ${scheme.name}`}
        description="Update the scheme's rules and calculator strategy, then save."
        backLink={{ href: '/admin/schemes', label: 'Back to schemes' }}
      />

      <div className="rounded-xl border border-hairline bg-card p-4 md:p-6">
        <SchemeFormFields
          id="edit-scheme-form"
          initial={scheme}
          onSubmit={(payload) =>
            updateScheme(
              { id: scheme.id, payload },
              { onSuccess: () => router.push('/admin/schemes') },
            )
          }
        />

        <div className="mt-6 flex flex-col-reverse gap-2 border-t border-hairline pt-4 md:flex-row md:items-center md:justify-end">
          <Button variant="secondary" asChild className="w-full md:w-auto">
            <a href="/admin/schemes">Cancel</a>
          </Button>
          <Button
            type="submit"
            form="edit-scheme-form"
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
