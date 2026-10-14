import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { TODAY } from '../support/fakes';
import { getPool, stop, truncateProjects } from '../support/postgres';
import { buildTestApp } from '../support/testApp';

const body = {
  name: 'Internal Tools',
  projectManager: { name: 'Sam Lee', email: 'sam.lee@example.com' },
  startDate: TODAY,
  endDate: TODAY,
  projectType: 'INTERNAL',
  billingType: 'NON_BILLABLE',
};

describe('GET /api/v1/projects/{projectId}', () => {
  const app = buildTestApp();

  beforeEach(async () => {
    await truncateProjects();
  });

  afterAll(async () => {
    await stop();
  });

  async function create() {
    const res = await request(app)
      .post('/api/v1/projects')
      .set('Idempotency-Key', randomUUID())
      .send(body)
      .expect(201);
    return res.body as { id: string; chargeCode: string };
  }

  it('returns the project with an ETag', async () => {
    const created = await create();
    const res = await request(app).get(`/api/v1/projects/${created.id}`).expect(200);
    expect(res.headers.etag).toBe('"1"');
    expect(res.body).toEqual({
      id: created.id,
      chargeCode: created.chargeCode,
      name: 'Internal Tools',
      projectManager: { name: 'Sam Lee', email: 'sam.lee@example.com' },
      startDate: TODAY,
      endDate: TODAY,
      projectType: 'INTERNAL',
      clientName: null,
      billingType: 'NON_BILLABLE',
      version: 1,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).get(`/api/v1/projects/${randomUUID()}`).expect(404);
    expect(res.body).toMatchObject({ code: 'PROJECT_NOT_FOUND' });
  });

  it('returns 400 for a non-UUID id', async () => {
    const res = await request(app).get('/api/v1/projects/not-a-uuid').expect(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('returns 404 for a soft-deleted project', async () => {
    const created = await create();
    await getPool().query('UPDATE project SET deleted_at = now() WHERE id = $1', [created.id]);
    const res = await request(app).get(`/api/v1/projects/${created.id}`).expect(404);
    expect(res.body).toMatchObject({ code: 'PROJECT_NOT_FOUND' });
  });
});
