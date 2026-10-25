'use client';

import { useRouter } from 'next/navigation';

import { PageHeader } from '@/components/layout/PageHeader';
import { InviteMemberFormFields } from '@/components/forms/MemberFormFields';
import { Button } from '@/components/ui/button';
import { useInviteUser } from '@/hooks/useInvites';
import { useBranches } from '@/hooks/useBranches';
import { useToast } from '@/lib/utils/notifications';

/**
 * Invite member — the create flow for a team member.
 *
 * The list page links here; on a successful send the router returns to the
 * list so the pending invitation is visible in context.
 */
export default function NewMemberPage() {
  const router = useRouter();
  const toast = useToast();
  const { data: branchesData } = useBranches();
  const { mutate: inviteUser, isPending: inviting } = useInviteUser();

  const branches = branchesData ?? [];

  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <PageHeader
        title="Invite member"
        description="Send an invitation email and assign the member's role."
        backLink={{ href: '/admin/members', label: 'Back to members' }}
      />

      <div className="rounded-xl border border-hairline bg-card p-4 md:p-6">
        <InviteMemberFormFields
          id="invite-member-form"
          branches={branches}
          onSubmit={(payload) =>
            inviteUser(payload, {
              onSuccess: (invite) => {
                router.push('/admin/members');
                // The email may not arrive (SMTP unconfigured or filtered), so
                // the link is surfaced for the administrator to share manually.
                if (invite?.inviteUrl) {
                  copyInviteLink(invite.inviteUrl);
                }
              },
            })
          }
        />

        <div className="mt-6 flex flex-col-reverse gap-2 border-t border-hairline pt-4 md:flex-row md:items-center md:justify-end">
          <Button variant="secondary" asChild className="w-full md:w-auto">
            <a href="/admin/members">Cancel</a>
          </Button>
          <Button
            type="submit"
            form="invite-member-form"
            disabled={inviting}
            className="w-full md:w-auto"
          >
            {inviting ? 'Sending…' : 'Send invitation'}
          </Button>
        </div>
      </div>
    </section>
  );

  async function copyInviteLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Invitation link copied');
    } catch {
      toast.error('Could not copy the link. Select it and copy manually.');
    }
  }
}
