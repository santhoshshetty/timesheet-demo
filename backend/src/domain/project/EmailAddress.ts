import type { Parsed } from './ProjectName';

export const MAX_EMAIL_LENGTH = 254;

// Same pattern as ajv-formats "fast" `email`, used by the API request validator.
const EMAIL_PATTERN =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i;

export const EmailAddress = {
  parse(raw: unknown): Parsed<string> {
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (value === '') return { ok: false, code: 'REQUIRED' };
    if (value.length > MAX_EMAIL_LENGTH) return { ok: false, code: 'TOO_LONG' };
    if (!EMAIL_PATTERN.test(value)) return { ok: false, code: 'INVALID_EMAIL' };
    return { ok: true, value: value.toLowerCase() };
  },
};
