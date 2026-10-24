import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-hairline bg-canvas px-md py-xl text-center">
      {icon ? <div className="mb-base text-muted">{icon}</div> : null}
      <h3 className="font-display text-title-md text-ink">{title}</h3>
      {description ? (
        <p className="mt-xs max-w-md text-body-sm text-body">{description}</p>
      ) : null}
      {action ? <div className="mt-lg">{action}</div> : null}
    </div>
  );
}