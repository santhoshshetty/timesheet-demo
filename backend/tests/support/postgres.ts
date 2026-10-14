import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { Pool } from 'pg';
import { createPool } from '../../src/infrastructure/db/pool';

/** Must match the `db` image in docker-compose.yml. */
export const POSTGRES_IMAGE = 'postgres:16.10-alpine';

const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

/** Runs the node-pg-migrate CLI with the current Node binary (no shell shims; works on Windows). */
export function runMigrations(databaseUrl: string): void {
  const packageJsonPath = require.resolve('node-pg-migrate/package.json');
  const { bin } = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
    bin: Record<string, string>;
  };
  const cli = path.join(path.dirname(packageJsonPath), bin['node-pg-migrate'] ?? '');
  execFileSync(
    process.execPath,
    [cli, 'up', '-m', MIGRATIONS_DIR, '--migration-file-language', 'sql'],
    { env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'pipe' },
  );
}

let pool: Pool | undefined;

export function getPool(): Pool {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) {
    throw new Error('TEST_DATABASE_URL is not set; is the Jest globalSetup configured?');
  }
  pool ??= createPool(connectionString);
  return pool;
}

export async function truncateProjects(): Promise<void> {
  await getPool().query('TRUNCATE TABLE project');
}

export async function stop(): Promise<void> {
  await pool?.end();
  pool = undefined;
}
