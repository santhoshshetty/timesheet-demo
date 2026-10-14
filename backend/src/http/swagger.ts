import fs from 'node:fs';
import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { parse } from 'yaml';

export function swaggerRoutes(contractPath: string): Router {
  const document = parse(fs.readFileSync(contractPath, 'utf8')) as swaggerUi.JsonObject;
  const router = Router();
  router.use('/api/docs', swaggerUi.serve, swaggerUi.setup(document));
  return router;
}
