'use client';

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { EditMemberFormFields } from '@/components/forms/MemberFormFields';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/feedback/Spinner';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { useMember, useUpdateMember } from '@/hooks/useMembers';

/**
 * Edit member — the edit flow.
 *
 * Shares `EditMemberFormFields` with nothing else (this page owns editing),
 * but keeps the same shape as the invite page so the two routes feel like
 * one feature: title, description, card, form, actions.
 */
export default function EditMemberPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const memberId = params?.id ?? null;

  const { data: member, isLoading, isError, refetch } = useMember(memberId);
  const { mutate: updateMember, isPending: updating } = useUpdateMember();

  if (isLoading) {
    return (
      <section className="flex flex-col gap-6 md:gap-8">
        <div className="flex items-center gap-sm text-body-sm text-body">
          <Spinner size={16} /> Loading member…
        </div>
      </section>
    );
  }

  if (isError || !member) {
    return (
      <section className="flex flex-col gap-6 md:gap-8">
        <PageHeader title="Edit member" />
        <ErrorBanner message="Could not load this member." retry={() => refetch()} />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <PageHeader
        title={`Edit ${member.name}`}
        description="Update the member's details, then save your changes."
        actions={
          <Button variant="secondary" asChild className="w-full md:w-auto">
            <a href="/admin/members">
              <ArrowLeft aria-hidden />
              Back to members
            </a>
          </Button>
        }
      />

      <div className="rounded-xl border border-hairline bg-card p-4 md:p-6">
        <EditMemberFormFields
          id="edit-member-form"
          member={member}
          onSubmit={(payload) =>
            updateMember(
              { id: member.id, payload },
              { onSuccess: () => router.push('/admin/members') },
            )
          }
        />

        <div className="mt-6 flex flex-col-reverse gap-2 border-t border-hairline pt-4 md:flex-row md:items-center md:justify-end">
          <Button variant="secondary" asChild className="w-full md:w-auto">
            <a href="/admin/members">Cancel</a>
          </Button>
          <Button
            type="submit"
            form="edit-member-form"
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
