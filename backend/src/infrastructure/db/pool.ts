import { Pool, types } from 'pg';

const DATE_OID = 1082;

// Keep `date` columns as `YYYY-MM-DD` strings; converting to JS Date would shift them by time zone.
types.setTypeParser(DATE_OID, (value: string) => value);

export function createPool(connectionString: string): Pool {
  return new Pool({ connectionString });
}
