import { randomUUID } from 'node:crypto';
import { CalendarDate } from '../../src/domain/project/CalendarDate';
import { ChargeCode } from '../../src/domain/project/ChargeCode';
import { ChargeCodeCollisionError } from '../../src/domain/project/errors';
import type { NewProject } from '../../src/domain/project/Project';
import { PgProjectRepository } from '../../src/infrastructure/db/PgProjectRepository';
import { getPool, stop, truncateProjects } from '../support/postgres';

function newProject(name: string, chargeCode: string): NewProject {
  return {
    name,
    projectManager: { name: 'Priya Shah', email: 'priya.shah@example.com' },
    startDate: CalendarDate.of('2026-10-06'),
    endDate: CalendarDate.of('2026-12-31'),
    projectType: 'INTERNAL',
    clientName: null,
    billingType: 'BILLABLE',
    chargeCode: ChargeCode.of(chargeCode),
    createRequestId: randomUUID(),
    version: 1,
  };
}

describe('PgProjectRepository.softDelete', () => {
  const repository = () => new PgProjectRepository(getPool());

  beforeEach(async () => {
    await truncateProjects();
  });

  afterAll(async () => {
    await stop();
  });

  it('marks the row deleted, keeps it, and increments the version', async () => {
    const saved = await repository().insert(newProject('Apollo', '00412345'));
    expect(await repository().softDelete(saved.id)).toBe(true);

    const { rows } = await getPool().query<{
      deleted_at: Date | null;
      updated_at: Date;
      version: number;
    }>('SELECT deleted_at, updated_at, version FROM project WHERE id = $1', [saved.id]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.deleted_at).not.toBeNull();
    expect(rows[0]?.updated_at.getTime()).toBeGreaterThanOrEqual(saved.updatedAt.getTime());
    expect(rows[0]?.version).toBe(2);
  });

  it('hides the project from reads and search', async () => {
    const saved = await repository().insert(newProject('Apollo', '00412345'));
    await repository().softDelete(saved.id);
    expect(await repository().findActiveById(saved.id)).toBeNull();
    const result = await repository().search({
      search: 'apollo',
      sort: 'name',
      order: 'asc',
      page: 1,
      pageSize: 25,
    });
    expect(result.totalItems).toBe(0);
  });

  it('keeps blocking reuse of the charge code', async () => {
    const saved = await repository().insert(newProject('Apollo', '00412345'));
    await repository().softDelete(saved.id);
    await expect(repository().insert(newProject('Gemini', '00412345'))).rejects.toBeInstanceOf(
      ChargeCodeCollisionError,
    );
  });

  it('affects 0 rows when deleting again', async () => {
    const saved = await repository().insert(newProject('Apollo', '00412345'));
    await repository().softDelete(saved.id);
    expect(await repository().softDelete(saved.id)).toBe(false);
  });
});
