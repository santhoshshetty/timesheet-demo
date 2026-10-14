import { randomUUID } from 'node:crypto';
import { CalendarDate } from '../../src/domain/project/CalendarDate';
import { ChargeCode } from '../../src/domain/project/ChargeCode';
import {
  ChargeCodeCollisionError,
  DuplicateCreateRequestError,
  ProjectNameTakenError,
} from '../../src/domain/project/errors';
import type { NewProject } from '../../src/domain/project/Project';
import { PgProjectRepository } from '../../src/infrastructure/db/PgProjectRepository';
import { getPool, stop, truncateProjects } from '../support/postgres';

let sequence = 0;

function newProject(overrides: Partial<NewProject> = {}): NewProject {
  sequence += 1;
  return {
    name: `Project ${sequence}`,
    projectManager: { name: 'Priya Shah', email: 'priya.shah@example.com' },
    startDate: CalendarDate.of('2026-10-06'),
    endDate: CalendarDate.of('2026-12-31'),
    projectType: 'INTERNAL',
    clientName: null,
    billingType: 'BILLABLE',
    chargeCode: ChargeCode.of(String(sequence).padStart(8, '0')),
    createRequestId: randomUUID(),
    version: 1,
    ...overrides,
  };
}

async function softDeleteDirectly(id: string): Promise<void> {
  await getPool().query('UPDATE project SET deleted_at = now() WHERE id = $1', [id]);
}

describe('PgProjectRepository (create and read)', () => {
  const repository = () => new PgProjectRepository(getPool());

  beforeEach(async () => {
    await truncateProjects();
  });

  afterAll(async () => {
    await stop();
  });

  it('round-trips a project and preserves leading zeros', async () => {
    const created = await repository().insert(
      newProject({ chargeCode: ChargeCode.of('00412345'), name: 'Apollo' }),
    );
    const found = await repository().findActiveById(created.id);
    expect(found?.chargeCode.toString()).toBe('00412345');
    expect(found?.name).toBe('Apollo');
    expect(found?.startDate.toString()).toBe('2026-10-06');
    expect(found?.version).toBe(1);
  });

  it('rejects a charge code already used by a deleted project', async () => {
    const deleted = await repository().insert(
      newProject({ chargeCode: ChargeCode.of('11111111') }),
    );
    await softDeleteDirectly(deleted.id);
    await expect(
      repository().insert(newProject({ chargeCode: ChargeCode.of('11111111') })),
    ).rejects.toBeInstanceOf(ChargeCodeCollisionError);
  });

  it('rejects an active name that differs only in case', async () => {
    await repository().insert(newProject({ name: 'Apollo Migration' }));
    await expect(
      repository().insert(newProject({ name: 'apollo migration' })),
    ).rejects.toBeInstanceOf(ProjectNameTakenError);
  });

  it('allows reusing the name of a deleted project', async () => {
    const deleted = await repository().insert(newProject({ name: 'Apollo Migration' }));
    await softDeleteDirectly(deleted.id);
    await expect(
      repository().insert(newProject({ name: 'Apollo Migration' })),
    ).resolves.toBeDefined();
  });

  it('lets exactly one of 10 concurrent inserts with the same name succeed', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => repository().insert(newProject({ name: 'Race' }))),
    );
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected.every((r) => r.reason instanceof ProjectNameTakenError)).toBe(true);
  });

  it('enforces the client name CHECK constraint', async () => {
    await expect(
      repository().insert(newProject({ projectType: 'CLIENT', clientName: null })),
    ).rejects.toMatchObject({ constraint: 'project_client_name_ck' });
    await expect(
      repository().insert(newProject({ projectType: 'INTERNAL', clientName: 'Contoso' })),
    ).rejects.toMatchObject({ constraint: 'project_client_name_ck' });
  });

  it('rejects a duplicate create request id', async () => {
    const createRequestId = randomUUID();
    await repository().insert(newProject({ createRequestId }));
    await expect(repository().insert(newProject({ createRequestId }))).rejects.toBeInstanceOf(
      DuplicateCreateRequestError,
    );
  });

  it('finds by create request id including deleted projects, but not by active id', async () => {
    const project = await repository().insert(newProject());
    await softDeleteDirectly(project.id);
    expect(await repository().findActiveById(project.id)).toBeNull();
    const replay = await repository().findByCreateRequestId(project.createRequestId);
    expect(replay?.isDeleted).toBe(true);
  });
});
