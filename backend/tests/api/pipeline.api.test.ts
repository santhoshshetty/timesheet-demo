import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { stop } from '../support/postgres';
import { buildTestApp } from '../support/testApp';

const UUID = /^[0-9a-f-]{36}$/i;

afterAll(async () => {
  await stop();
});

describe('HTTP pipeline', () => {
  const app = buildTestApp();

  it('reports liveness and readiness', async () => {
    await request(app).get('/health/live').expect(200, { status: 'ok' });
    await request(app).get('/health/ready').expect(200, { status: 'ok' });
  });

  it('echoes a valid X-Request-Id and generates one otherwise', async () => {
    const id = '7b0f6c1e-3d2a-4f7e-9a51-2a4f0c9d8e11';
    const echoed = await request(app).get('/health/live').set('X-Request-Id', id);
    expect(echoed.headers['x-request-id']).toBe(id);

    const generated = await request(app).get('/health/live').set('X-Request-Id', 'not-a-uuid');
    expect(generated.headers['x-request-id']).toMatch(UUID);
    expect(generated.headers['x-request-id']).not.toBe('not-a-uuid');
  });

  it('sets security headers and hides X-Powered-By', async () => {
    const res = await request(app).get('/health/live');
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('returns ROUTE_NOT_FOUND Problem Details for unknown API paths', async () => {
    const res = await request(app).get('/api/v1/unknown').expect(404);
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
    expect(res.body).toMatchObject({ status: 404, code: 'ROUTE_NOT_FOUND' });
    expect(res.body.requestId).toMatch(UUID);
  });

  it('returns METHOD_NOT_ALLOWED for unsupported methods', async () => {
    const res = await request(app).patch('/api/v1/projects').send({}).expect(405);
    expect(res.body).toMatchObject({ status: 405, code: 'METHOD_NOT_ALLOWED' });
  });

  it('rejects bodies larger than 100 KB', async () => {
    const res = await request(app)
      .post('/api/v1/projects')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ name: 'x'.repeat(200 * 1024) }))
      .expect(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  describe('with a built frontend', () => {
    const staticDir = fs.mkdtempSync(path.join(os.tmpdir(), 'timesheet-static-'));
    fs.mkdirSync(path.join(staticDir, 'assets'));
    fs.writeFileSync(path.join(staticDir, 'index.html'), '<html><body>SPA</body></html>');
    fs.writeFileSync(path.join(staticDir, 'assets', 'app.js'), 'console.log("app");');
    const appWithFrontend = buildTestApp({ staticDir });

    afterAll(() => {
      fs.rmSync(staticDir, { recursive: true, force: true });
    });

    it('serves index.html for browser routes (SPA fallback)', async () => {
      const res = await request(appWithFrontend).get('/projects/new').expect(200);
      expect(res.text).toContain('SPA');
    });

    it('serves static assets', async () => {
      const res = await request(appWithFrontend).get('/assets/app.js').expect(200);
      expect(res.text).toContain('console.log');
    });

    it('serves Swagger UI', async () => {
      const res = await request(appWithFrontend).get('/api/docs/').expect(200);
      expect(res.text).toContain('swagger-ui');
    });

    it('still returns Problem Details for unknown API paths', async () => {
      const res = await request(appWithFrontend).get('/api/v1/unknown').expect(404);
      expect(res.body).toMatchObject({ code: 'ROUTE_NOT_FOUND' });
    });
  });
});
