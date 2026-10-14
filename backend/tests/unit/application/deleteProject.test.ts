import { makeCreateProject } from '../../../src/application/project/createProject';
import { makeDeleteProject } from '../../../src/application/project/deleteProject';
import { ProjectNotFoundError } from '../../../src/domain/project/errors';
import {
  FixedClock,
  InMemoryUnitOfWork,
  SequenceChargeCodeGenerator,
  TODAY,
} from '../../support/fakes';

async function setup() {
  const unitOfWork = new InMemoryUnitOfWork();
  const clock = new FixedClock();
  const { project } = await makeCreateProject({
    unitOfWork,
    chargeCodes: new SequenceChargeCodeGenerator(['00412345']),
    clock,
  })({
    input: {
      name: 'Apollo',
      projectManager: { name: 'Priya Shah', email: 'priya.shah@example.com' },
      startDate: TODAY,
      endDate: TODAY,
      projectType: 'INTERNAL',
      billingType: 'BILLABLE',
    },
    createRequestId: 'key-1',
  });
  return { unitOfWork, project, deleteProject: makeDeleteProject({ unitOfWork, clock }) };
}

describe('deleteProject', () => {
  it('soft-deletes the project and keeps its row', async () => {
    const { unitOfWork, project, deleteProject } = await setup();
    await deleteProject(project.id);
    expect(unitOfWork.projects.rows[0]?.deletedAt).not.toBeNull();
    expect(unitOfWork.projects.rows).toHaveLength(1);
  });

  it('throws ProjectNotFoundError for a missing project', async () => {
    const { deleteProject } = await setup();
    await expect(deleteProject('missing')).rejects.toBeInstanceOf(ProjectNotFoundError);
  });

  it('throws ProjectNotFoundError when already deleted', async () => {
    const { project, deleteProject } = await setup();
    await deleteProject(project.id);
    await expect(deleteProject(project.id)).rejects.toBeInstanceOf(ProjectNotFoundError);
  });
});
