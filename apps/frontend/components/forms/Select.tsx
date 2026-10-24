import { type SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export function Select({ label, error, id, children, className, ...rest }: SelectProps) {
  const reactId = id ?? `select-${Math.random().toString(36).slice(2, 9)}`;
  return (
    <div className="flex flex-col gap-xs">
      {label ? (
        <label htmlFor={reactId} className="text-body-sm font-semibold text-ink">
          {label}
        </label>
      ) : null}
      <select
        id={reactId}
        {...rest}
        className={`cb-input ${error ? 'border-semantic-down' : ''} ${className ?? ''}`}
      >
        {children}
      </select>
      {error ? <span className="text-caption text-semantic-down">{error}</span> : null}
    </div>
  );
}