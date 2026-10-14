import { CalendarDate } from '../../../src/domain/project/CalendarDate';
import { ChargeCode } from '../../../src/domain/project/ChargeCode';
import { EmailAddress } from '../../../src/domain/project/EmailAddress';
import { ProjectName } from '../../../src/domain/project/ProjectName';
import { ACCEPTED_EMAILS, REJECTED_EMAILS } from '../../support/emailCases';

describe('CalendarDate', () => {
  it('accepts real dates including leap days', () => {
    expect(CalendarDate.parse('2026-02-28')?.toString()).toBe('2026-02-28');
    expect(CalendarDate.parse('2028-02-29')?.toString()).toBe('2028-02-29');
  });

  it.each(['2026-02-31', '2026-13-01', '26-01-01', '2027-02-29', '2026-00-10', ''])(
    'rejects %p',
    (value) => {
      expect(CalendarDate.parse(value)).toBeNull();
    },
  );

  it('compares dates', () => {
    const earlier = CalendarDate.of('2026-01-31');
    const later = CalendarDate.of('2026-02-01');
    expect(earlier.isBefore(later)).toBe(true);
    expect(later.isAfter(earlier)).toBe(true);
    expect(earlier.equals(CalendarDate.of('2026-01-31'))).toBe(true);
  });
});

describe('ChargeCode', () => {
  it('accepts 8 digits and preserves leading zeros', () => {
    expect(ChargeCode.of('00412345').toString()).toBe('00412345');
  });

  it.each(['1234567', '123456789', '1234567a', ''])('rejects %p', (value) => {
    expect(() => ChargeCode.of(value)).toThrow(RangeError);
  });
});

describe('ProjectName', () => {
  it('trims the value', () => {
    expect(ProjectName.parse('  Apollo  ')).toEqual({ ok: true, value: 'Apollo' });
  });

  it('rejects blank names', () => {
    expect(ProjectName.parse('   ')).toEqual({ ok: false, code: 'REQUIRED' });
  });

  it('accepts 100 characters after trim and rejects 101', () => {
    expect(ProjectName.parse(` ${'a'.repeat(100)} `).ok).toBe(true);
    expect(ProjectName.parse('a'.repeat(101))).toEqual({ ok: false, code: 'TOO_LONG' });
  });
});

describe('EmailAddress', () => {
  it('trims and lower-cases', () => {
    expect(EmailAddress.parse('  Priya@Example.COM ')).toEqual({
      ok: true,
      value: 'priya@example.com',
    });
  });

  it.each(ACCEPTED_EMAILS)('accepts %p', (value) => {
    expect(EmailAddress.parse(value).ok).toBe(true);
  });

  it.each(REJECTED_EMAILS)('rejects %p', (value) => {
    expect(EmailAddress.parse(value).ok).toBe(false);
  });

  it('rejects addresses longer than 254 characters as too long', () => {
    expect(EmailAddress.parse(`${'a'.repeat(243)}@example.com`)).toEqual({
      ok: false,
      code: 'TOO_LONG',
    });
  });
});
