/**
 * Helpers for parsing optional query-string parameters.
 *
 * Query parameters arrive as raw strings. `Number('abc')` and `Number('')`
 * both produce `NaN`, and a `NaN` value passed into a Prisma filter makes
 * Prisma reject the entire query with a validation error. These helpers
 * treat anything that is not a valid number as "not provided" so a bad
 * query string can never break a request.
 */

/** Parses an optional integer query parameter. */
export function parseOptionalInt(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed)) return undefined;
  return parsed;
}

/** Parses a required integer query parameter, falling back to `fallback`. */
export function parseIntWithFallback(value: string | undefined, fallback: number): number {
  return parseOptionalInt(value) ?? fallback;
}

/** Normalises an optional string query parameter (blank becomes undefined). */
export function parseOptionalString(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}
