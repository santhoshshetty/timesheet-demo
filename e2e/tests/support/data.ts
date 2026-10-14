/** Unique per run so repeated runs never collide with the active-name uniqueness rule. */
const runId = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
let counter = 0;

export function uniqueName(prefix: string): string {
  counter += 1;
  return `${prefix} ${runId}-${counter}`;
}

/** Today in UTC, matching BUSINESS_TIME_ZONE=UTC in .env.example. */
export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}
