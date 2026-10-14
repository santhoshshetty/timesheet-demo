import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { FixedClock, TODAY } from '../support/fakes';
import { getPool, stop, truncateProjects } from '../support/postgres';
import { buildTestApp } from '../support/testApp';

const body = {
  name: 'Apollo Migration',
  projectManager: { name: 'Priya Shah', email: 'priya.shah@example.com' },
  startDate: TODAY,
  endDate: '2026-12-31',
  projectType: 'CLIENT',
  clientName: 'Contoso',
  billingType: 'BILLABLE',
};

describe('PUT /api/v1/projects/{projectId}', () => {
  const clock = new FixedClock();
  const app = buildTestApp({ clock });

  beforeEach(async () => {
    clock.todayValue = TODAY;
    await truncateProjects();
  });

  afterAll(async () => {
    await stop();
  });

  async function create(overrides: Record<string, unknown> = {}) {
    const res = await request(app)
      .post('/api/v1/projects')
      .set('Idempotency-Key', randomUUID())
      .send({ ...body, ...overrides })
      .expect(201);
    return res.body as { id: string; chargeCode: string };
  }

  const put = (id: string, ifMatch: string | undefined, payload: object) => {
    const req = request(app).put(`/api/v1/projects/${id}`).send(payload);
    return ifMatch === undefined ? req : req.set('If-Match', ifMatch);
  };

  it('updates the project, returns ETag "2", and keeps the charge code', async () => {
    const created = await create();
    const res = await put(created.id, '"1"', {
      ...body,
      name: 'Apollo Phase 2',
      endDate: '2027-03-31',
    }).expect(200);
    expect(res.headers.etag).toBe('"2"');
    expect(res.body).toMatchObject({
      id: created.id,
      chargeCode: created.chargeCode,
      name: 'Apollo Phase 2',
      endDate: '2027-03-31',
      version: 2,
    });
  });

  it('returns 428 when If-Match is missing', async () => {
    const created = await create();
    const res = await put(created.id, undefined, body).expect(428);
    expect(res.body).toMatchObject({ code: 'PRECONDITION_REQUIRED' });
  });

  it.each(['abc', '"0"', 'W/"1"', '"1.5"'])('returns 400 for If-Match %s', async (ifMatch) => {
    const created = await create();
    const res = await put(created.id, ifMatch, body).expect(400);
    expect(res.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      errors: [{ field: 'If-Match', code: 'INVALID_FORMAT' }],
    });
  });

  it('returns 412 for a stale If-Match', async () => {
    const created = await create();
    await put(created.id, '"1"', { ...body, name: 'First edit' }).expect(200);
    const res = await put(created.id, '"1"', { ...body, name: 'Second edit' }).expect(412);
    expect(res.body).toMatchObject({ code: 'VERSION_CONFLICT' });
  });

  it('returns 404 for an unknown or deleted project', async () => {
    await put(randomUUID(), '"1"', body).expect(404);
    const created = await create();
    await getPool().query('UPDATE project SET deleted_at = now() WHERE id = $1', [created.id]);
    const res = await put(created.id, '"1"', body).expect(404);
    expect(res.body).toMatchObject({ code: 'PROJECT_NOT_FOUND' });
  });

  it('returns 409 for a duplicate name', async () => {
    await create({ name: 'Gemini' });
    const created = await create();
    const res = await put(created.id, '"1"', { ...body, name: 'gemini' }).expect(409);
    expect(res.body).toMatchObject({ code: 'PROJECT_NAME_TAKEN' });
  });

  it('returns 422 when a changed Start Date is in the past', async () => {
    const created = await create();
    clock.todayValue = '2026-10-10';
    const res = await put(created.id, '"1"', { ...body, startDate: '2026-10-08' }).expect(422);
    expect(res.body).toMatchObject({
      errors: [{ field: 'startDate', code: 'START_DATE_IN_PAST' }],
    });
  });

  it('accepts an unchanged Start Date that is now in the past', async () => {
    const created = await create();
    clock.todayValue = '2026-10-10';
    await put(created.id, '"1"', body).expect(200);
  });

  it('returns 422 when the End Date is shortened', async () => {
    const created = await create();
    const res = await put(created.id, '"1"', { ...body, endDate: '2026-12-30' }).expect(422);
    expect(res.body).toMatchObject({
      errors: [{ field: 'endDate', code: 'END_DATE_SHORTENED' }],
    });
  });

  it('rejects a chargeCode in the body with 400 UNKNOWN_FIELD', async () => {
    const created = await create();
    const res = await put(created.id, '"1"', { ...body, chargeCode: '12345678' }).expect(400);
    expect(res.body).toMatchObject({
      errors: [expect.objectContaining({ field: 'chargeCode', code: 'UNKNOWN_FIELD' })],
    });
  });
});
