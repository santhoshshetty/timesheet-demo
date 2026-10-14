import fs from 'node:fs';
import path from 'node:path';
import express, { type Express, type RequestHandler, type Response } from 'express';
import * as OpenApiValidator from 'express-openapi-validator';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { AppConfig } from '../infrastructure/config/config';
import type { AppLogger } from '../infrastructure/logging/logger';
import { healthRoutes, type ReadinessCheck } from './health';
import { errorHandler, notFound } from './problemDetails';
import { requestId } from './requestId';
import { projectRoutes, type ProjectUseCases } from './routes/projects';
import { swaggerRoutes } from './swagger';

export interface AppDependencies {
  config: Pick<AppConfig, 'appEnv' | 'contractPath' | 'staticDir' | 'swaggerEnabled'>;
  logger: AppLogger;
  checkReadiness: ReadinessCheck;
  projects: ProjectUseCases;
}

const NON_API_PATHS = /^(?!\/(api\/v1|health)\/)/;

export function createApp(deps: AppDependencies): Express {
  const { config } = deps;
  const app = express();

  // (1) Security, parsing, correlation, request logging.
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'style-src': ["'self'", "'unsafe-inline'"],
          // Lower environments may be served over plain HTTP.
          'upgrade-insecure-requests': null,
        },
      },
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(requestId);
  app.use(
    pinoHttp({
      logger: deps.logger.pino,
      genReqId: (_req, res) => (res as unknown as Response).locals.requestId as string,
    }),
  );

  // (2) Health checks and API docs.
  app.use(healthRoutes(deps.checkReadiness));
  if (config.swaggerEnabled) {
    app.use(swaggerRoutes(config.contractPath));
  }

  // (3) Frontend hosting, before the validator so browser routes are never treated as API paths.
  if (fs.existsSync(config.staticDir)) {
    app.use(express.static(config.staticDir));
    app.use(spaFallback(config.staticDir));
  } else {
    deps.logger.info('Static frontend directory not found; static hosting disabled', {
      staticDir: config.staticDir,
    });
  }

  // (4) Contract validation for /api/v1/* and /health/* only.
  app.use(
    OpenApiValidator.middleware({
      apiSpec: config.contractPath,
      validateRequests: { allErrors: true },
      validateFormats: true,
      ajvFormats: { mode: 'fast' },
      validateResponses: config.appEnv === 'development' || config.appEnv === 'test',
      ignorePaths: NON_API_PATHS,
    }),
  );

  // (5) API routes; authentication middleware will be added to this router (Principle III).
  const api = express.Router();
  api.use(projectRoutes(deps.projects));
  app.use('/api/v1', api);

  // (6) Not found and error handling.
  app.use(notFound);
  app.use(errorHandler(deps.logger));

  return app;
}

function spaFallback(staticDir: string): RequestHandler {
  const indexFile = path.join(staticDir, 'index.html');
  return (req, res, next) => {
    const isPageRequest = req.method === 'GET' || req.method === 'HEAD';
    const isApiPath = req.path.startsWith('/api') || req.path.startsWith('/health');
    if (!isPageRequest || isApiPath || !fs.existsSync(indexFile)) {
      next();
      return;
    }
    res.sendFile(indexFile);
  };
}
