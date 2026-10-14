import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { TODAY } from '../support/fakes';
import { stop, truncateProjects } from '../support/postgres';
import { buildTestApp } from '../support/testApp';

describe('GET /api/v1/projects', () => {
  const app = buildTestApp();

  beforeEach(async () => {
    await truncateProjects();
  });

  afterAll(async () => {
    await stop();
  });

  async function create(name: string, extra: Record<string, unknown> = {}) {
    await request(app)
      .post('/api/v1/projects')
      .set('Idempotency-Key', randomUUID())
      .send({
        name,
        projectManager: { name: 'Priya Shah', email: 'priya.shah@example.com' },
        startDate: TODAY,
        endDate: TODAY,
        projectType: 'INTERNAL',
        billingType: 'BILLABLE',
        ...extra,
      })
      .expect(201);
  }

  it('returns an empty page when there are no projects', async () => {
    const res = await request(app).get('/api/v1/projects').expect(200);
    expect(res.body).toEqual({ items: [], page: 1, pageSize: 25, totalItems: 0, totalPages: 0 });
  });

  it('applies the defaults: page 1, 25 per page, sorted by name ascending', async () => {
    await create('Bravo');
    await create('alpha');
    const res = await request(app).get('/api/v1/projects').expect(200);
    expect(res.body).toMatchObject({ page: 1, pageSize: 25, totalItems: 2, totalPages: 1 });
    expect((res.body as { items: Array<{ name: string }> }).items.map((p) => p.name)).toEqual([
      'alpha',
      'Bravo',
    ]);
  });

  it('pages and sorts with query parameters', async () => {
    await create('Alpha');
    await create('Bravo');
    await create('Charlie');
    const res = await request(app)
      .get('/api/v1/projects')
      .query({ sort: 'name', order: 'desc', page: 2, pageSize: 2 })
      .expect(200);
    expect(res.body).toMatchObject({ page: 2, pageSize: 2, totalItems: 3, totalPages: 2 });
    expect((res.body as { items: Array<{ name: string }> }).items.map((p) => p.name)).toEqual([
      'Alpha',
    ]);
  });

  it('searches by manager email and by client name', async () => {
    await create('Apollo', {
      projectManager: { name: 'Sam Lee', email: 'sam.lee@example.com' },
    });
    await create('Gemini', { projectType: 'CLIENT', clientName: 'Contoso Ltd' });

    const byEmail = await request(app).get('/api/v1/projects?search=SAM.LEE').expect(200);
    expect((byEmail.body as { items: Array<{ name: string }> }).items.map((p) => p.name)).toEqual([
      'Apollo',
    ]);
    const byClient = await request(app).get('/api/v1/projects?search=%20contoso%20').expect(200);
    expect((byClient.body as { items: Array<{ name: string }> }).items.map((p) => p.name)).toEqual([
      'Gemini',
    ]);
  });

  it('accepts form-encoded search terms with spaces and reserved characters', async () => {
    await create('Apollo Migration');
    await create('R&D Tools');
    const spaced = await request(app).get('/api/v1/projects?search=apollo+mig').expect(200);
    expect((spaced.body as { items: Array<{ name: string }> }).items.map((p) => p.name)).toEqual([
      'Apollo Migration',
    ]);
    const reserved = await request(app).get('/api/v1/projects?search=r%26d').expect(200);
    expect((reserved.body as { items: Array<{ name: string }> }).items.map((p) => p.name)).toEqual([
      'R&D Tools',
    ]);
  });

  it.each([
    ['pageSize=101', 'pageSize'],
    ['sort=createdAt', 'sort'],
    ['page=0', 'page'],
  ])('rejects %s with 400 INVALID_VALUE', async (query, field) => {
    const res = await request(app).get(`/api/v1/projects?${query}`).expect(400);
    expect(res.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      errors: [expect.objectContaining({ field, code: 'INVALID_VALUE' })],
    });
  });
});
