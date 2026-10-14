import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import request from 'supertest';
import { createLogger } from '../../src/infrastructure/logging/logger';
import { TODAY } from '../support/fakes';
import { stop, truncateProjects } from '../support/postgres';
import { buildTestApp } from '../support/testApp';

const MANAGER_EMAIL = 'private.manager@example.com';
const BODY_SENTINEL = 'Private Body Sentinel';
const CLIENT_SENTINEL = 'Private Client Sentinel';

const body = {
  name: BODY_SENTINEL,
  projectManager: { name: 'Private Manager', email: MANAGER_EMAIL },
  startDate: TODAY,
  endDate: '2026-12-31',
  projectType: 'CLIENT',
  clientName: CLIENT_SENTINEL,
  billingType: 'BILLABLE',
};

describe('API log privacy', () => {
  let output = '';
  const destination = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      output += chunk.toString();
      callback();
    },
  });
  const app = buildTestApp({ logger: createLogger('info', destination) });

  beforeEach(async () => {
    output = '';
    await truncateProjects();
  });

  afterAll(async () => {
    await stop();
  });

  it('never logs manager emails or request bodies', async () => {
    const created = await request(app)
      .post('/api/v1/projects')
      .set('Idempotency-Key', randomUUID())
      .send(body)
      .expect(201);

    await request(app)
      .put(`/api/v1/projects/${created.body.id}`)
      .set('If-Match', created.headers.etag as string)
      .send({ ...body, endDate: '2027-01-31' })
      .expect(200);

    // Failed requests: duplicate name (409), structural validation (400), business rule (422).
    await request(app)
      .post('/api/v1/projects')
      .set('Idempotency-Key', randomUUID())
      .send(body)
      .expect(409);
    await request(app)
      .post('/api/v1/projects')
      .set('Idempotency-Key', randomUUID())
      .send({ ...body, name: `${BODY_SENTINEL} 2`, chargeCode: '12345678' })
      .expect(400);
    await request(app)
      .post('/api/v1/projects')
      .set('Idempotency-Key', randomUUID())
      .send({ ...body, name: `${BODY_SENTINEL} 3`, startDate: '2026-01-01' })
      .expect(422);

    expect(output).not.toBe('');
    expect(output.toLowerCase()).not.toContain(MANAGER_EMAIL);
    expect(output).not.toContain(BODY_SENTINEL);
    expect(output).not.toContain(CLIENT_SENTINEL);
  });
});
