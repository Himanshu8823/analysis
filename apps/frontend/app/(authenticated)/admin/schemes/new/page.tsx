'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { SchemeFormFields } from '@/components/forms/SchemeFormFields';
import { Button } from '@/components/ui/button';
import { useCreateScheme } from '@/hooks/useSchemes';

/**
 * New scheme — the create flow.
 *
 * The form is the same component the edit page uses; it is simply rendered
 * without an existing scheme to pre-populate it.
 */
export default function NewSchemePage() {
  const router = useRouter();
  const { mutate: createScheme, isPending: creating } = useCreateScheme();

  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <PageHeader
        title="New scheme"
        description="Define an evaluation scheme, its rules and calculator strategy."
        actions={
          <Button variant="secondary" asChild className="w-full md:w-auto">
            <a href="/admin/schemes">
              <ArrowLeft aria-hidden />
              Back to schemes
            </a>
          </Button>
        }
      />

      <div className="rounded-xl border border-hairline bg-card p-4 md:p-6">
        <SchemeFormFields
          id="new-scheme-form"
          onSubmit={(payload) =>
            createScheme(payload, { onSuccess: () => router.push('/admin/schemes') })
          }
        />

        <div className="mt-6 flex flex-col-reverse gap-2 border-t border-hairline pt-4 md:flex-row md:items-center md:justify-end">
          <Button variant="secondary" asChild className="w-full md:w-auto">
            <a href="/admin/schemes">Cancel</a>
          </Button>
          <Button
            type="submit"
            form="new-scheme-form"
            disabled={creating}
            className="w-full md:w-auto"
          >
            {creating ? 'Creating…' : 'Create scheme'}
          </Button>
        </div>
      </div>
    </section>
  );
}
