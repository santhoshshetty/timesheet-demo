import { BusinessTimeZoneClock } from '../../../src/infrastructure/clock/BusinessTimeZoneClock';

describe('BusinessTimeZoneClock', () => {
  const instant = new Date('2026-10-06T23:30:00Z');

  it('returns the next calendar day in Asia/Tokyo', () => {
    const clock = new BusinessTimeZoneClock('Asia/Tokyo', () => instant);
    expect(clock.today().toString()).toBe('2026-10-07');
  });

  it('returns the same calendar day in UTC', () => {
    const clock = new BusinessTimeZoneClock('UTC', () => instant);
    expect(clock.today().toString()).toBe('2026-10-06');
  });

  it('returns the current instant from now()', () => {
    const clock = new BusinessTimeZoneClock('UTC', () => instant);
    expect(clock.now()).toBe(instant);
  });
});
