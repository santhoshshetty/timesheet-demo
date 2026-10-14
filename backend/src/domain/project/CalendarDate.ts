const PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A calendar date (`YYYY-MM-DD`) without time of day or time zone. */
export class CalendarDate {
  private constructor(private readonly value: string) {}

  /** Returns null when the input is not a real calendar date (e.g. `2026-02-31`). */
  static parse(input: string): CalendarDate | null {
    const match = PATTERN.exec(input);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
    return new CalendarDate(input);
  }

  static of(input: string): CalendarDate {
    const date = CalendarDate.parse(input);
    if (!date) throw new RangeError(`Not a valid calendar date: ${input}`);
    return date;
  }

  isBefore(other: CalendarDate): boolean {
    return this.value < other.value;
  }

  isAfter(other: CalendarDate): boolean {
    return this.value > other.value;
  }

  equals(other: CalendarDate): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}
