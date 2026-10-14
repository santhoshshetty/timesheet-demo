import os from 'node:os';
import path from 'node:path';
import type { Express } from 'express';
import { makeCreateProject } from '../../src/application/project/createProject';
import { makeDeleteProject } from '../../src/application/project/deleteProject';
import { makeGetProject } from '../../src/application/project/getProject';
import { makeListProjects } from '../../src/application/project/listProjects';
import { makeUpdateProject } from '../../src/application/project/updateProject';
import type { ChargeCodeGenerator, Clock } from '../../src/domain/project/ports';
import { createApp } from '../../src/http/app';
import { RandomChargeCodeGenerator } from '../../src/infrastructure/charge-code/RandomChargeCodeGenerator';
import { DEFAULT_CONTRACT_PATH } from '../../src/infrastructure/config/config';
import { PgUnitOfWork } from '../../src/infrastructure/db/PgUnitOfWork';
import { createLogger, type AppLogger } from '../../src/infrastructure/logging/logger';
import { FixedClock } from './fakes';
import { getPool } from './postgres';

export interface TestAppOverrides {
  chargeCodes?: ChargeCodeGenerator;
  clock?: Clock;
  logger?: AppLogger;
  staticDir?: string;
}

const NO_STATIC_DIR = path.join(os.tmpdir(), 'timesheet-demo-no-static-dir');

/** The app wired to the Testcontainers database, a fixed clock, and response validation on. */
export function buildTestApp(overrides: TestAppOverrides = {}): Express {
  const pool = getPool();
  const unitOfWork = new PgUnitOfWork(pool);
  const clock = overrides.clock ?? new FixedClock();

  return createApp({
    config: {
      appEnv: 'test',
      contractPath: DEFAULT_CONTRACT_PATH,
      staticDir: overrides.staticDir ?? NO_STATIC_DIR,
      swaggerEnabled: true,
    },
    logger: overrides.logger ?? createLogger('silent'),
    checkReadiness: async () => {
      await pool.query('SELECT 1');
    },
    projects: {
      createProject: makeCreateProject({
        unitOfWork,
        chargeCodes: overrides.chargeCodes ?? new RandomChargeCodeGenerator(),
        clock,
      }),
      getProject: makeGetProject({ unitOfWork }),
      listProjects: makeListProjects({ unitOfWork }),
      updateProject: makeUpdateProject({ unitOfWork, clock }),
      deleteProject: makeDeleteProject({ unitOfWork, clock }),
    },
  });
}
