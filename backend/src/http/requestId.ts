import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const REQUEST_ID_HEADER = 'X-Request-Id';

export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.header(REQUEST_ID_HEADER);
  const id = incoming && UUID_PATTERN.test(incoming) ? incoming : randomUUID();
  res.locals.requestId = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
};

export function getRequestId(locals: Record<string, unknown>): string {
  return typeof locals.requestId === 'string' ? locals.requestId : randomUUID();
}
