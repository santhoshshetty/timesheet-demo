import { makeCreateProject } from '../../../src/application/project/createProject';
import {
  ChargeCodeUnavailableError,
  ProjectNameTakenError,
  ProjectNotFoundError,
  ProjectValidationError,
} from '../../../src/domain/project/errors';
import type { ProjectInput } from '../../../src/domain/project/Project';
import {
  FixedClock,
  InMemoryUnitOfWork,
  SequenceChargeCodeGenerator,
  TODAY,
} from '../../support/fakes';

const input: ProjectInput = {
  name: 'Apollo Migration',
  projectManager: { name: 'Priya Shah', email: 'priya.shah@example.com' },
  startDate: TODAY,
  endDate: '2026-12-31',
  projectType: 'INTERNAL',
  billingType: 'NON_BILLABLE',
};

function setup(codes: string[] = ['00412345', '87654321']) {
  const unitOfWork = new InMemoryUnitOfWork();
  const chargeCodes = new SequenceChargeCodeGenerator(codes);
  const clock = new FixedClock();
  const createProject = makeCreateProject({ unitOfWork, chargeCodes, clock });
  return { unitOfWork, chargeCodes, clock, createProject };
}

describe('createProject', () => {
  it('creates a project using the clock and the generated charge code', async () => {
    const { createProject } = setup();
    const { project, replayed } = await createProject({ input, createRequestId: 'key-1' });
    expect(replayed).toBe(false);
    expect(project.chargeCode.toString()).toBe('00412345');
    expect(project.startDate.toString()).toBe(TODAY);
  });

  it('uses the clock to reject past start dates', async () => {
    const { createProject, clock } = setup();
    clock.todayValue = '2026-10-07';
    await expect(createProject({ input, createRequestId: 'key-1' })).rejects.toBeInstanceOf(
      ProjectValidationError,
    );
  });

  it('retries with the next code after a charge-code collision', async () => {
    const { createProject } = setup(['00412345', '00412345', '87654321']);
    await createProject({ input, createRequestId: 'key-1' });
    const { project } = await createProject({
      input: { ...input, name: 'Second' },
      createRequestId: 'key-2',
    });
    expect(project.chargeCode.toString()).toBe('87654321');
  });

  it('fails with ChargeCodeUnavailableError after 5 collisions and stores nothing', async () => {
    const { createProject, unitOfWork, chargeCodes } = setup(['00412345']);
    await createProject({ input, createRequestId: 'key-1' });
    await expect(
      createProject({ input: { ...input, name: 'Second' }, createRequestId: 'key-2' }),
    ).rejects.toBeInstanceOf(ChargeCodeUnavailableError);
    expect(unitOfWork.projects.rows).toHaveLength(1);
    expect(chargeCodes.calls).toBe(6);
  });

  it('returns the existing project for a repeated create request without a new code', async () => {
    const { createProject, chargeCodes } = setup();
    const first = await createProject({ input, createRequestId: 'key-1' });
    const second = await createProject({ input, createRequestId: 'key-1' });
    expect(second.replayed).toBe(true);
    expect(second.project.id).toBe(first.project.id);
    expect(chargeCodes.calls).toBe(1);
  });

  it('treats a replay of a deleted project as not found', async () => {
    const { createProject, unitOfWork } = setup();
    const { project } = await createProject({ input, createRequestId: 'key-1' });
    unitOfWork.projects.markDeleted(project.id);
    await expect(createProject({ input, createRequestId: 'key-1' })).rejects.toBeInstanceOf(
      ProjectNotFoundError,
    );
  });

  it('rejects a duplicate active name', async () => {
    const { createProject } = setup();
    await createProject({ input, createRequestId: 'key-1' });
    await expect(
      createProject({ input: { ...input, name: 'APOLLO MIGRATION' }, createRequestId: 'key-2' }),
    ).rejects.toBeInstanceOf(ProjectNameTakenError);
  });
});
