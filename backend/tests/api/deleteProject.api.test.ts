import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { TODAY } from '../support/fakes';
import { stop, truncateProjects } from '../support/postgres';
import { buildTestApp } from '../support/testApp';

const body = {
  name: 'Apollo Migration',
  projectManager: { name: 'Priya Shah', email: 'priya.shah@example.com' },
  startDate: TODAY,
  endDate: TODAY,
  projectType: 'INTERNAL',
  billingType: 'BILLABLE',
};

describe('DELETE /api/v1/projects/{projectId}', () => {
  const app = buildTestApp();

  beforeEach(async () => {
    await truncateProjects();
  });

  afterAll(async () => {
    await stop();
  });

  it('soft-deletes the project so it is gone from every endpoint', async () => {
    const key = randomUUID();
    const created = await request(app)
      .post('/api/v1/projects')
      .set('Idempotency-Key', key)
      .send(body)
      .expect(201);
    const { id } = created.body as { id: string };

    await request(app).delete(`/api/v1/projects/${id}`).expect(204);

    await request(app).get(`/api/v1/projects/${id}`).expect(404);
    await request(app).delete(`/api/v1/projects/${id}`).expect(404);
    await request(app).put(`/api/v1/projects/${id}`).set('If-Match', '"1"').send(body).expect(404);
    const list = await request(app).get('/api/v1/projects').expect(200);
    expect(list.body).toMatchObject({ items: [], totalItems: 0 });
    const replay = await request(app)
      .post('/api/v1/projects')
      .set('Idempotency-Key', key)
      .send(body)
      .expect(404);
    expect(replay.body).toMatchObject({ code: 'PROJECT_NOT_FOUND' });
  });

  it('returns 404 for an unknown project', async () => {
    const res = await request(app).delete(`/api/v1/projects/${randomUUID()}`).expect(404);
    expect(res.body).toMatchObject({ code: 'PROJECT_NOT_FOUND' });
  });
});
