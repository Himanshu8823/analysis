'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { ImageUp, Loader2, Trash2 } from 'lucide-react';

import { UserAvatar } from '@/components/ui/user-avatar';
import { Button } from '@/components/ui/button';

/**
 * The image types the picker accepts — the same set the backend validates.
 *
 * The check here is a courtesy that saves the member a round trip; the
 * server decides the real type from the bytes and is the authority.
 */
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

/** The largest picture the picker accepts: 5 MB. */
const MAX_BYTES = 5 * 1024 * 1024;

interface AvatarPickerProps {
  name: string;
  avatarUrl?: string | null;
  onSelect: (file: File) => void;
  onRemove: () => void;
  /** True while an upload is in flight. */
  uploading?: boolean;
  /** True while the picture is being removed. */
  removing?: boolean;
}

/**
 * AvatarPicker — the profile picture control.
 *
 * The picture is shown large, with the member's initials underneath when
 * there is no picture. Two actions sit below it: one to choose a picture,
 * one to remove the current one.
 *
 * The file input is hidden and driven by a label styled as a button, so the
 * control is reachable by keyboard and by touch without a separate
 * "browse" affordance hidden inside a native dialog.
 */
export function AvatarPicker({
  name,
  avatarUrl,
  onSelect,
  onRemove,
  uploading = false,
  removing = false,
}: AvatarPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // The input is reset so choosing the same file twice still fires a change.
    event.target.value = '';
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setLocalError('The file must be a PNG, JPEG, GIF or WebP image.');
      return;
    }

    if (file.size > MAX_BYTES) {
      setLocalError('The image must be smaller than 5 MB.');
      return;
    }

    setLocalError(null);
    onSelect(file);
  };

  const busy = uploading || removing;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <UserAvatar
          name={name}
          avatarUrl={avatarUrl}
          size="lg"
          className="ring-1 ring-hairline"
        />
        {busy ? (
          <span
            className="absolute inset-0 flex items-center justify-center rounded-full bg-surface-strong/70"
            aria-hidden
          >
            <Loader2 className="size-6 animate-spin text-ink" />
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          <ImageUp aria-hidden />
          {avatarUrl ? 'Change picture' : 'Upload picture'}
        </Button>

        {avatarUrl ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onRemove}
            disabled={busy}
            className="text-semantic-down hover:bg-surface-soft hover:text-semantic-down"
          >
            <Trash2 aria-hidden />
            Remove
          </Button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={handleChange}
        className="sr-only"
        aria-label="Choose a profile picture"
      />

      {localError ? (
        <p role="alert" className="text-body-sm text-semantic-down">
          {localError}
        </p>
      ) : null}

      {!localError ? (
        <p className="text-center text-caption text-muted">
          PNG, JPEG, GIF or WebP. Up to 5 MB.
        </p>
      ) : null}
    </div>
  );
}
