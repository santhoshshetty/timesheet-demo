import { makeCreateProject } from '../../../src/application/project/createProject';
import { makeUpdateProject } from '../../../src/application/project/updateProject';
import {
  ProjectNameTakenError,
  ProjectNotFoundError,
  VersionConflictError,
} from '../../../src/domain/project/errors';
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
  endDate: '2026-12-31',
  projectType: 'INTERNAL',
  billingType: 'BILLABLE',
};

async function setup() {
  const unitOfWork = new InMemoryUnitOfWork();
  const clock = new FixedClock();
  const createProject = makeCreateProject({
    unitOfWork,
    chargeCodes: new SequenceChargeCodeGenerator(['00412345', '87654321']),
    clock,
  });
  const { project } = await createProject({ input, createRequestId: 'key-1' });
  return {
    unitOfWork,
    project,
    updateProject: makeUpdateProject({ unitOfWork, clock }),
    createProject,
  };
}

describe('updateProject', () => {
  it('updates the project and increments the version', async () => {
    const { project, updateProject } = await setup();
    const updated = await updateProject({
      id: project.id,
      input: { ...input, name: 'Apollo 2' },
      expectedVersion: 1,
    });
    expect(updated.name).toBe('Apollo 2');
    expect(updated.version).toBe(2);
    expect(updated.chargeCode.toString()).toBe('00412345');
  });

  it('throws ProjectNotFoundError for a missing project', async () => {
    const { updateProject } = await setup();
    await expect(
      updateProject({ id: 'missing', input, expectedVersion: 1 }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });

  it('throws ProjectNotFoundError for a deleted project', async () => {
    const { unitOfWork, project, updateProject } = await setup();
    unitOfWork.projects.markDeleted(project.id);
    await expect(
      updateProject({ id: project.id, input, expectedVersion: 1 }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });

  it('throws VersionConflictError when the expected version is stale', async () => {
    const { project, updateProject } = await setup();
    await expect(
      updateProject({ id: project.id, input, expectedVersion: 2 }),
    ).rejects.toBeInstanceOf(VersionConflictError);
  });

  it('re-reads after a lost race: a concurrent edit is a version conflict', async () => {
    const { unitOfWork, project, updateProject } = await setup();
    unitOfWork.projects.beforeUpdate = () => unitOfWork.projects.bumpVersion(project.id);
    await expect(
      updateProject({ id: project.id, input, expectedVersion: 1 }),
    ).rejects.toBeInstanceOf(VersionConflictError);
  });

  it('re-reads after a lost race: a concurrent delete is not found', async () => {
    const { unitOfWork, project, updateProject } = await setup();
    unitOfWork.projects.beforeUpdate = () => unitOfWork.projects.markDeleted(project.id);
    await expect(
      updateProject({ id: project.id, input, expectedVersion: 1 }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });

  it('throws ProjectNameTakenError for a duplicate name', async () => {
    const { project, updateProject, createProject } = await setup();
    await createProject({ input: { ...input, name: 'Gemini' }, createRequestId: 'key-2' });
    await expect(
      updateProject({ id: project.id, input: { ...input, name: 'GEMINI' }, expectedVersion: 1 }),
    ).rejects.toBeInstanceOf(ProjectNameTakenError);
  });
});
