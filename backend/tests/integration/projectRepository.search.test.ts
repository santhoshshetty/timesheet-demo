import { randomUUID } from 'node:crypto';
import { CalendarDate } from '../../src/domain/project/CalendarDate';
import { ChargeCode } from '../../src/domain/project/ChargeCode';
import type { SearchCriteria } from '../../src/domain/project/ports';
import type { NewProject } from '../../src/domain/project/Project';
import { PgProjectRepository } from '../../src/infrastructure/db/PgProjectRepository';
import { getPool, stop, truncateProjects } from '../support/postgres';

function newProject(overrides: Partial<NewProject> & { chargeCode: ChargeCode }): NewProject {
  return {
    name: `Project ${overrides.chargeCode.toString()}`,
    projectManager: { name: 'Priya Shah', email: 'priya.shah@example.com' },
    startDate: CalendarDate.of('2026-10-06'),
    endDate: CalendarDate.of('2026-12-31'),
    projectType: 'INTERNAL',
    clientName: null,
    billingType: 'BILLABLE',
    createRequestId: randomUUID(),
    version: 1,
    ...overrides,
  };
}

const all: SearchCriteria = { sort: 'name', order: 'asc', page: 1, pageSize: 100 };

describe('PgProjectRepository.search', () => {
  const repository = () => new PgProjectRepository(getPool());
  const names = async (criteria: Partial<SearchCriteria>) =>
    (await repository().search({ ...all, ...criteria })).items.map((p) => p.name);

  beforeEach(async () => {
    await truncateProjects();
  });

  afterAll(async () => {
    await stop();
  });

  describe('matching', () => {
    beforeEach(async () => {
      const repo = repository();
      await repo.insert(
        newProject({
          name: 'Apollo Migration',
          chargeCode: ChargeCode.of('00412345'),
          projectType: 'CLIENT',
          clientName: 'Contoso Ltd',
        }),
      );
      await repo.insert(
        newProject({
          name: 'Gemini',
          chargeCode: ChargeCode.of('55500001'),
          projectManager: { name: 'Sam Lee', email: 'sam.lee@example.com' },
        }),
      );
      await repo.insert(
        newProject({ name: '100% Done_Now', chargeCode: ChargeCode.of('55500002') }),
      );
      await repo.insert(newProject({ name: 'Back\\slash', chargeCode: ChargeCode.of('55500003') }));
    });

    it.each([
      ['name', 'apollo', ['Apollo Migration']],
      ['charge code prefix', '0041', ['Apollo Migration']],
      ['manager name', 'SAM', ['Gemini']],
      ['manager email', 'sam.lee@', ['Gemini']],
      ['client name', 'contoso', ['Apollo Migration']],
    ])('matches by %s', async (_label, search, expected) => {
      expect(await names({ search })).toEqual(expected);
    });

    it.each([
      ['%', ['100% Done_Now']],
      ['_', ['100% Done_Now']],
      ['\\', ['Back\\slash']],
    ])('matches %p literally', async (search, expected) => {
      expect(await names({ search })).toEqual(expected);
    });

    it('never returns deleted projects', async () => {
      const { items } = await repository().search({ ...all, search: 'gemini' });
      await repository().softDelete(items[0]?.id ?? '');
      expect(await names({ search: 'gemini' })).toEqual([]);
      expect(await names({})).not.toContain('Gemini');
    });
  });

  describe('sorting and paging', () => {
    beforeEach(async () => {
      const repo = repository();
      await repo.insert(
        newProject({
          name: 'bravo',
          chargeCode: ChargeCode.of('30000000'),
          startDate: CalendarDate.of('2026-11-01'),
          endDate: CalendarDate.of('2026-11-30'),
        }),
      );
      await repo.insert(
        newProject({
          name: 'Alpha',
          chargeCode: ChargeCode.of('20000000'),
          startDate: CalendarDate.of('2026-12-01'),
          endDate: CalendarDate.of('2026-12-02'),
        }),
      );
      await repo.insert(
        newProject({
          name: 'Charlie',
          chargeCode: ChargeCode.of('10000000'),
          startDate: CalendarDate.of('2026-10-10'),
          endDate: CalendarDate.of('2027-01-01'),
        }),
      );
    });

    it.each([
      ['name', 'asc', ['Alpha', 'bravo', 'Charlie']],
      ['name', 'desc', ['Charlie', 'bravo', 'Alpha']],
      ['chargeCode', 'asc', ['Charlie', 'Alpha', 'bravo']],
      ['startDate', 'asc', ['Charlie', 'bravo', 'Alpha']],
      ['endDate', 'desc', ['Charlie', 'Alpha', 'bravo']],
    ] as const)('sorts by %s %s', async (sort, order, expected) => {
      expect(await names({ sort, order })).toEqual(expected);
    });

    it('slices pages and reports the total', async () => {
      const second = await repository().search({ ...all, page: 2, pageSize: 2 });
      expect(second.totalItems).toBe(3);
      expect(second.items.map((p) => p.name)).toEqual(['Charlie']);
      const beyond = await repository().search({ ...all, page: 5, pageSize: 2 });
      expect(beyond).toEqual({ items: [], totalItems: 3 });
    });
  });

  it('searches 10,000 projects in under 500 ms', async () => {
    await getPool().query(
      `INSERT INTO project (charge_code, name, project_manager_name, project_manager_email,
         start_date, end_date, project_type, client_name, billing_type, create_request_id)
       SELECT lpad(i::text, 8, '0'), 'Perf project ' || i, 'Manager ' || i,
         'manager' || i || '@example.com', DATE '2026-10-06', DATE '2026-12-31',
         'CLIENT', 'Client ' || i, 'BILLABLE', gen_random_uuid()
       FROM generate_series(1, 10000) AS i`,
    );
    await getPool().query('ANALYZE project');
    const started = performance.now();
    const result = await repository().search({ ...all, search: 'client 99', pageSize: 25 });
    const elapsed = performance.now() - started;
    expect(result.totalItems).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(500);
  });
});
