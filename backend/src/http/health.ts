import { Router } from 'express';

export type ReadinessCheck = () => Promise<void>;

export function healthRoutes(checkReadiness: ReadinessCheck): Router {
  const router = Router();

  router.get('/health/live', (_req, res) => {
    res.json({ status: 'ok' });
  });

  router.get('/health/ready', async (_req, res) => {
    try {
      await checkReadiness();
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });

  return router;
}
