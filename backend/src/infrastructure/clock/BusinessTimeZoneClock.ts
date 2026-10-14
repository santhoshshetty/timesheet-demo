import { CalendarDate } from '../../domain/project/CalendarDate';
import type { Clock } from '../../domain/project/ports';

export class BusinessTimeZoneClock implements Clock {
  private readonly formatter: Intl.DateTimeFormat;

  constructor(
    timeZone: string,
    private readonly currentInstant: () => Date = () => new Date(),
  ) {
    this.formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  today(): CalendarDate {
    const parts = this.formatter.formatToParts(this.currentInstant());
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value ?? '';
    return CalendarDate.of(`${get('year')}-${get('month')}-${get('day')}`);
  }

  now(): Date {
    return this.currentInstant();
  }
}
