import { makeListProjects } from '../../../src/application/project/listProjects';
import { makeCreateProject } from '../../../src/application/project/createProject';
import type { ProjectInput } from '../../../src/domain/project/Project';
import {
  FixedClock,
  InMemoryUnitOfWork,
  SequenceChargeCodeGenerator,
  TODAY,
} from '../../support/fakes';

const input: ProjectInput = {
  name: 'Apollo',
  projectManager: { name: 'Priya Shah', email: 'priya.shah@example.com' },
  startDate: TODAY,
  endDate: TODAY,
  projectType: 'INTERNAL',
  billingType: 'BILLABLE',
};

const defaults = { sort: 'name', order: 'asc', page: 1, pageSize: 2 } as const;

async function setup(names: string[]) {
  const unitOfWork = new InMemoryUnitOfWork();
  const createProject = makeCreateProject({
    unitOfWork,
    chargeCodes: new SequenceChargeCodeGenerator(names.map((_, i) => String(i).padStart(8, '0'))),
    clock: new FixedClock(),
  });
  for (const [i, name] of names.entries()) {
    await createProject({ input: { ...input, name }, createRequestId: `key-${i}` });
  }
  return { unitOfWork, listProjects: makeListProjects({ unitOfWork }) };
}

describe('listProjects', () => {
  it('trims the search term', async () => {
    const { unitOfWork, listProjects } = await setup(['Apollo', 'Gemini']);
    const page = await listProjects({ ...defaults, search: '  gem  ' });
    expect(unitOfWork.projects.lastSearch?.search).toBe('gem');
    expect(page.items.map((p) => p.name)).toEqual(['Gemini']);
  });

  it.each(['', '   ', undefined])('treats %p as no filter', async (search) => {
    const { unitOfWork, listProjects } = await setup(['Apollo', 'Gemini']);
    const page = await listProjects({ ...defaults, search });
    expect(unitOfWork.projects.lastSearch?.search).toBeUndefined();
    expect(page.totalItems).toBe(2);
  });

  it('computes totalPages from totalItems and pageSize', async () => {
    const { listProjects } = await setup(['A', 'B', 'C']);
    const page = await listProjects({ ...defaults, page: 2 });
    expect(page).toMatchObject({ page: 2, pageSize: 2, totalItems: 3, totalPages: 2 });
    expect(page.items.map((p) => p.name)).toEqual(['C']);
  });

  it('returns zero pages when there are no projects', async () => {
    const { listProjects } = await setup([]);
    const page = await listProjects(defaults);
    expect(page).toMatchObject({ items: [], totalItems: 0, totalPages: 0 });
  });
});
