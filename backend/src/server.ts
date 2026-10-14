import type { Server } from 'node:http';
import { makeCreateProject } from './application/project/createProject';
import { makeDeleteProject } from './application/project/deleteProject';
import { makeGetProject } from './application/project/getProject';
import { makeListProjects } from './application/project/listProjects';
import { makeUpdateProject } from './application/project/updateProject';
import { createApp } from './http/app';
import { RandomChargeCodeGenerator } from './infrastructure/charge-code/RandomChargeCodeGenerator';
import { BusinessTimeZoneClock } from './infrastructure/clock/BusinessTimeZoneClock';
import { ConfigError, loadConfig, type AppConfig } from './infrastructure/config/config';
import { createPool } from './infrastructure/db/pool';
import { PgUnitOfWork } from './infrastructure/db/PgUnitOfWork';
import { createLogger } from './infrastructure/logging/logger';

function readConfig(): AppConfig {
  try {
    return loadConfig();
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    console.error(error.message);
    process.exit(1);
  }
}

function main(): void {
  const config = readConfig();
  const logger = createLogger(config.logLevel);
  const pool = createPool(config.databaseUrl);
  const unitOfWork = new PgUnitOfWork(pool);
  const clock = new BusinessTimeZoneClock(config.businessTimeZone);

  const app = createApp({
    config,
    logger,
    checkReadiness: async () => {
      await pool.query('SELECT 1');
    },
    projects: {
      createProject: makeCreateProject({
        unitOfWork,
        chargeCodes: new RandomChargeCodeGenerator(),
        clock,
      }),
      getProject: makeGetProject({ unitOfWork }),
      listProjects: makeListProjects({ unitOfWork }),
      updateProject: makeUpdateProject({ unitOfWork, clock }),
      deleteProject: makeDeleteProject({ unitOfWork, clock }),
    },
  });

  const server: Server = app.listen(config.port, () => {
    logger.info('Server listening', { port: config.port, appEnv: config.appEnv });
  });

  const shutdown = (signal: string) => {
    logger.info('Shutting down', { signal });
    server.close(() => {
      void pool.end().finally(() => process.exit(0));
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
