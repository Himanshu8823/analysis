'use client';

import { useCallback, useRef, useState, type DragEvent, type ChangeEvent } from 'react';
import { UploadCloud, FileSpreadsheet, FileText } from 'lucide-react';

const ACCEPTED_MIME = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/pdf',
];
const ACCEPTED_EXT = '.xlsx,.xls,.csv,.pdf';

/**
 * What the uploader accepts.
 *
 * A screen that wants one kind of file says so. The scheme reader takes a
 * PDF and nothing else, and a drop zone that also advertised Excel would be
 * inviting the user to upload the wrong thing — a file the server will
 * refuse with a message they then have to interpret.
 */
export interface FileUploaderAccept {
  /** The extensions, as a comma-separated string — `.pdf`. */
  extensions: string;
  /** The MIME types, as a comma-separated string. */
  mimeTypes: string;
  /** The label shown under the drop zone — `PDF`. */
  label: string;
}

/** The default — the result files the exam cell deals with. */
const RESULT_FILES: FileUploaderAccept = {
  extensions: ACCEPTED_EXT,
  mimeTypes: ACCEPTED_MIME.join(','),
  label: 'Excel or PDF',
};

/** A syllabus document — a PDF and nothing else. */
export const PDF_ONLY: FileUploaderAccept = {
  extensions: '.pdf',
  mimeTypes: 'application/pdf',
  label: 'PDF',
};

interface FileUploaderProps {
  onFile: (file: File) => void;
  isUploading?: boolean;
  hint?: string;
  /** Called when a dropped/selected file is not an accepted type. */
  onReject?: (reason: string) => void;
  /** Blocks the picker entirely — used when the surrounding form is incomplete. */
  disabled?: boolean;
  /** What the uploader accepts. Defaults to the result-file types. */
  accept?: FileUploaderAccept;
}

/**
 * Client-side type guard.
 *
 * The extension is checked alongside the MIME type because browsers report
 * inconsistent MIME types for CSV (and sometimes for `.xls`). This is a
 * convenience check only — the server re-validates every upload.
 */
function isAcceptedFile(file: File, accept: FileUploaderAccept): boolean {
  const mimeOk =
    file.type === '' || accept.mimeTypes.split(',').map((t) => t.trim()).includes(file.type);
  const extOk = accept.extensions
    .split(',')
    .map((ext) => ext.trim())
    .some((ext) => file.name.toLowerCase().endsWith(ext));
  return mimeOk && extOk;
}

export function FileUploader({
  onFile,
  isUploading = false,
  hint,
  onReject,
  disabled = false,
  accept = RESULT_FILES,
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const blocked = isUploading || disabled;

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!isAcceptedFile(file, accept)) {
        const reason = `That file type is not supported here. Upload a ${accept.label} file.`;
        setError(reason);
        onReject?.(reason);
        return;
      }
      setError(null);
      onFile(file);
    },
    [onFile, onReject, accept],
  );

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (blocked) return;
    handleFiles(e.dataTransfer.files);
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    e.target.value = '';
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`flex w-full max-w-3xl flex-col items-center justify-center rounded-xl border-2 border-dashed bg-surface-soft px-md py-xl text-center transition-colors ${
          isDragging ? 'border-primary bg-surface-strong' : 'border-hairline'
        } ${blocked ? 'opacity-60' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept.extensions}
          onChange={onChange}
          disabled={blocked}
          className="sr-only"
          aria-label="Upload file"
        />
        <div className="mb-base inline-flex h-14 w-14 items-center justify-center rounded-full bg-surface-strong text-primary">
          <UploadCloud className="h-7 w-7" aria-hidden />
        </div>
        <p className="text-body-md text-ink">
          <button
            type="button"
            className="font-semibold text-primary underline-offset-4 hover:underline disabled:cursor-not-allowed"
            onClick={() => inputRef.current?.click()}
            disabled={blocked}
          >
            Click to upload
          </button>{' '}
          or drag &amp; drop
        </p>
        <p className="mt-xs text-body-sm text-muted">
          {hint ?? 'Excel (.xlsx, .xls), CSV, or PDF up to 50MB'}
        </p>
        <div className="mt-lg flex items-center gap-sm text-body-sm text-muted">
          {accept.extensions.includes('.xlsx') ? (
            <>
              <span className="inline-flex items-center gap-1">
                <FileSpreadsheet className="h-4 w-4" aria-hidden /> Excel
              </span>
              <span aria-hidden>·</span>
            </>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <FileText className="h-4 w-4" aria-hidden /> PDF
          </span>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-xs text-body-sm text-semantic-down">
          {error}
        </p>
      ) : null}
    </div>
  );
}