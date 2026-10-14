const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Formats a `YYYY-MM-DD` calendar date as `DD MMM YYYY` without time-zone conversion. */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  const monthName = MONTHS[Number(month) - 1];
  if (!year || !day || !monthName) return isoDate;
  return `${day} ${monthName} ${year}`;
}

/** Today's date in the browser's local time zone as `YYYY-MM-DD`. */
export function localToday(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
