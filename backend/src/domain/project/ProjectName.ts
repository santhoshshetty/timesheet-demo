import type { FieldErrorCode } from './errors';

export type Parsed<T> = { ok: true; value: T } | { ok: false; code: FieldErrorCode };

export const MAX_NAME_LENGTH = 100;

/** Trims and checks a required text value of at most `maxLength` characters. */
export function parseRequiredText(raw: unknown, maxLength: number): Parsed<string> {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (value === '') return { ok: false, code: 'REQUIRED' };
  if (value.length > maxLength) return { ok: false, code: 'TOO_LONG' };
  return { ok: true, value };
}

export const ProjectName = {
  parse(raw: unknown): Parsed<string> {
    return parseRequiredText(raw, MAX_NAME_LENGTH);
  },
};
