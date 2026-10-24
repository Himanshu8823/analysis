'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
};

export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-surface-dark/60 p-0 md:items-center md:p-base"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={`flex w-full flex-col rounded-t-xl bg-canvas shadow-coinbase md:rounded-xl ${SIZE_MAP[size]} md:w-full`}
        style={{ maxHeight: '90vh' }}
      >
        <header className="flex items-center justify-between border-b border-hairline px-base py-sm">
          <h2 id="modal-title" className="font-display text-title-md text-ink">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface-strong hover:text-ink"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-base py-base">{children}</div>
        {footer ? (
          <footer className="flex flex-col-reverse items-stretch gap-sm border-t border-hairline px-base py-sm md:flex-row md:items-center md:justify-end">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}