'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { AvatarPicker } from '@/components/forms/AvatarPicker';
import { Button } from '@/components/ui/button';
import { useCurrentUser, useRemoveAvatar, useUpdateProfile, useUploadAvatar } from '@/hooks/useAuth';

/**
 * My account — the signed-in member's own profile.
 *
 * Two things are editable here: the display name and the profile picture.
 * The email is shown but never editable — it identifies the account and is
 * the login, so changing it is an administrative act rather than a personal
 * one. It is rendered as a disabled field with a note saying so, rather
 * than being hidden, because seeing which email the account uses is part of
 * knowing which account is signed in.
 *
 * The page renders from the cached session user, so it works for every
 * role — a student's account page is the same page as an admin's, just with
 * the same limited set of fields.
 */
export default function MyAccountPage() {
  const { data: user, isLoading } = useCurrentUser();

  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const removeAvatar = useRemoveAvatar();

  /**
   * The form is seeded from the session user once it arrives.
   *
   * It is seeded into local state rather than rendered directly from the
   * query, because the field is editable — the member types a new name
   * before saving, and that draft must not be overwritten by a cache
   * refresh.
   */
  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user?.name]);

  if (isLoading || !user) {
    return (
      <section className="flex flex-col gap-6 md:gap-8">
        <PageHeader title="My account" description="Your profile details and preferences." />
        <div className="flex items-center gap-sm text-body-sm text-body">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Loading your account…
        </div>
      </section>
    );
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError('Your name must be at least 2 characters.');
      return;
    }

    updateProfile.mutate(
      { name: trimmed },
      {
        onError: (err: unknown) => {
          const e = err as { response?: { data?: { message?: string } } };
          setError(e.response?.data?.message ?? 'We could not update your profile.');
        },
      },
    );
  };

  const nameChanged = name.trim() !== user.name.trim();

  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <PageHeader
        title="My account"
        description="Your profile details and preferences."
      />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        {/* Profile picture — its own card on mobile, a column beside the
            details on desktop. */}
        <div className="rounded-xl border border-hairline bg-card p-4 md:p-6 lg:w-80 lg:shrink-0">
          <h2 className="mb-4 text-body-sm font-semibold text-ink">Profile picture</h2>
          <AvatarPicker
            name={user.name}
            avatarUrl={user.avatarUrl}
            uploading={uploadAvatar.isPending}
            removing={removeAvatar.isPending}
            onSelect={(file) => uploadAvatar.mutate(file)}
            onRemove={() => removeAvatar.mutate()}
          />
        </div>

        {/* Account details */}
        <div className="min-w-0 flex-1 rounded-xl border border-hairline bg-card p-4 md:p-6">
          <h2 className="mb-4 text-body-sm font-semibold text-ink">Account details</h2>

          <form onSubmit={onSubmit} className="flex flex-col gap-base" noValidate>
            <label className="flex flex-col gap-xs">
              <span className="text-body-sm font-semibold text-ink">Full name</span>
              <input
                type="text"
                name="name"
                required
                minLength={2}
                maxLength={100}
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="cb-input"
                placeholder="Your full name"
                aria-invalid={!!error}
              />
              <span className="text-body-sm text-muted">
                This is the name shown next to your uploads, marks and reports.
              </span>
            </label>

            {/*
                The email is deliberately disabled. It identifies the account
                and is the login, so it is never changed from here — an
                administrator changes it through the member management flow.
            */}
            <label className="flex flex-col gap-xs">
              <span className="text-body-sm font-semibold text-ink">Email</span>
              <input
                type="email"
                name="email"
                value={user.email}
                readOnly
                disabled
                aria-describedby="email-help"
                className="cb-input cursor-not-allowed bg-surface-soft text-muted"
              />
              <span id="email-help" className="text-body-sm text-muted">
                Your email cannot be changed here. Contact an administrator to change it.
              </span>
            </label>

            {error ? (
              <div
                role="alert"
                className="rounded-md border border-hairline bg-surface-soft px-sm py-xs text-body-sm text-semantic-down"
              >
                {error}
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-2 border-t border-hairline pt-4 sm:flex-row sm:items-center sm:justify-end">
              <Button
                type="submit"
                disabled={updateProfile.isPending || !nameChanged}
                className="w-full sm:w-auto"
              >
                {updateProfile.isPending ? (
                  <span className="inline-flex items-center gap-sm">
                    <Loader2 className="size-4 animate-spin" aria-hidden /> Saving
                  </span>
                ) : (
                  'Save changes'
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
