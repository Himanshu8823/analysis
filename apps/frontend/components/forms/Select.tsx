'use client';

import { Children, useId, isValidElement, type ReactNode, type SelectHTMLAttributes } from 'react';

import {
  Select as SelectRoot,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

/**
 * The value Radix uses for an option that carries the empty string.
 *
 * Radix refuses an empty string as an item value — the item is dropped from
 * the list and the trigger falls back to its placeholder. Options like
 * `<option value="">Select a branch</option>` are legitimate and used
 * throughout the forms, so the empty string is translated to this sentinel
 * on the way in and back again on the way out.
 */
const EMPTY_SENTINEL = '__empty__';

/**
 * Flattens an option's children into plain text.
 *
 * Radix needs a `textValue` for every item — it is what the trigger shows and
 * what type-ahead matches on. Option labels are often JSX (e.g. a code and a
 * name in two spans), so the text is pulled out of the element tree.
 */
function flattenText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join('');
  if (isValidElement(node)) {
    return flattenText((node.props as { children?: ReactNode }).children);
  }
  return '';
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value' | 'defaultValue' | 'children' | 'dir'> {
  label?: string;
  error?: string;
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (event: { target: { value: string } }) => void;
  /**
   * The options, written as `<option>` elements.
   *
   * They are translated into the design system's `SelectItem` below, so every
   * call site keeps the plain, readable `<option value="…">` markup while the
   * rendered control is the Radix-backed dropdown from `components/ui/select`.
   */
  children?: ReactNode;
  /** Placeholder shown when nothing is selected. */
  placeholder?: string;
}

/**
 * Select — the labelled dropdown used by every form in the app.
 *
 * Design rationale:
 * - The rendered control is the Radix-backed `SelectTrigger`/`SelectContent`
 *   pair from `components/ui/select`, so the dropdown matches the rest of the
 *   design system (check-mark on the active option, chevron affordance,
 *   keyboard navigation) instead of the browser's native dropdown, which
 *   cannot be themed.
 * - The public API still accepts `<option>` children. Radix needs
 *   `SelectItem` elements instead, so the options are converted here rather
 *   than at every call site — this keeps the forms declarative and means a
 *   new form cannot accidentally reintroduce a native `<select>`.
 * - The label is a real `<label>` bound to the trigger via `aria-labelledby`,
 *   and the error is wired through `aria-describedby`, so screen readers
 *   announce the field name and the validation message.
 */
export function Select({
  label,
  error,
  value,
  defaultValue,
  onChange,
  children,
  placeholder,
  className,
  id,
  disabled,
  required,
  ...rest
}: SelectProps) {
  const generatedId = useId();
  const reactId = id ?? generatedId;
  const labelId = label ? `${reactId}-label` : undefined;
  const errorId = error ? `${reactId}-error` : undefined;

  /**
   * Translates between the caller-facing value and the Radix-facing one.
   * The empty string is the caller's "nothing selected" state; Radix needs a
   * non-empty value for that, so the sentinel stands in for it.
   */
  const toRadixValue = (raw: string | number | undefined): string | undefined => {
    if (raw === undefined) return undefined;
    const asString = String(raw);
    return asString === '' ? EMPTY_SENTINEL : asString;
  };

  const fromRadixValue = (next: string): string =>
    next === EMPTY_SENTINEL ? '' : next;

  const handleValueChange = (next: string) => {
    onChange?.({ target: { value: fromRadixValue(next) } });
  };

  const items = Children.toArray(children)
    .filter((child) => isValidElement(child))
    .map((child) => {
      const props = child.props as { value?: string | number; disabled?: boolean; children?: ReactNode };
      // The value is always a string on the wire — an `<option value={1}>` has
      // a numeric value, and Radix matches items by string, so a number would
      // never line up with the string the caller passes back.
      const optionValue = props.value === undefined ? '' : String(props.value);
      const radixValue = toRadixValue(optionValue) as string;
      return (
        <SelectItem
          key={radixValue}
          value={radixValue}
          disabled={props.disabled}
          textValue={flattenText(props.children)}
        >
          {props.children}
        </SelectItem>
      );
    });

  return (
    <div className={cn('flex flex-col gap-xs', className)}>
      {label ? (
        <label id={labelId} className="text-body-sm font-semibold text-ink">
          {label}
        </label>
      ) : null}

      <SelectRoot
        value={toRadixValue(value)}
        defaultValue={toRadixValue(defaultValue)}
        onValueChange={handleValueChange}
        disabled={disabled}
        {...rest}
      >
        <SelectTrigger
          id={reactId}
          aria-labelledby={labelId}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          // The trigger is a button, not a select, so the browser's own
          // required-validation does not apply. It is announced instead, and
          // the form validates the field itself.
          aria-required={required || undefined}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{items}</SelectContent>
      </SelectRoot>

      {error ? (
        <span id={errorId} className="text-caption text-semantic-down">
          {error}
        </span>
      ) : null}
    </div>
  );
}
