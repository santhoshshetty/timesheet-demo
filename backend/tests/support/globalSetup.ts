import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { POSTGRES_IMAGE, runMigrations } from './postgres';

declare global {
  var __POSTGRES_CONTAINER__: StartedPostgreSqlContainer | undefined;
}

export default async function globalSetup(): Promise<void> {
  const container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  const url = container.getConnectionUri();
  runMigrations(url);
  process.env.TEST_DATABASE_URL = url;
  globalThis.__POSTGRES_CONTAINER__ = container;
}
