import { randomUUID } from 'node:crypto';
import { CalendarDate } from '../../src/domain/project/CalendarDate';
import { ChargeCode } from '../../src/domain/project/ChargeCode';
import { ProjectNameTakenError } from '../../src/domain/project/errors';
import type { NewProject, Project, ProjectInput } from '../../src/domain/project/Project';
import { PgProjectRepository } from '../../src/infrastructure/db/PgProjectRepository';
import { getPool, stop, truncateProjects } from '../support/postgres';

const today = CalendarDate.of('2026-10-06');
let sequence = 0;

function newProject(name: string): NewProject {
  sequence += 1;
  return {
    name,
    projectManager: { name: 'Priya Shah', email: 'priya.shah@example.com' },
    startDate: today,
    endDate: CalendarDate.of('2026-12-31'),
    projectType: 'INTERNAL',
    clientName: null,
    billingType: 'BILLABLE',
    chargeCode: ChargeCode.of(String(sequence).padStart(8, '0')),
    createRequestId: randomUUID(),
    version: 1,
  };
}

function inputFrom(project: Project, overrides: Partial<ProjectInput> = {}): ProjectInput {
  return {
    name: project.name,
    projectManager: project.projectManager,
    startDate: project.startDate.toString(),
    endDate: project.endDate.toString(),
    projectType: project.projectType,
    clientName: project.clientName,
    billingType: project.billingType,
    ...overrides,
  };
}

describe('PgProjectRepository.update', () => {
  const repository = () => new PgProjectRepository(getPool());

  beforeEach(async () => {
    await truncateProjects();
  });

  afterAll(async () => {
    await stop();
  });

  it('updates when the version matches and keeps the charge code', async () => {
    const saved = await repository().insert(newProject('Apollo'));
    const updated = await repository().update(
      saved.update(inputFrom(saved, { name: 'Apollo 2', endDate: '2027-01-31' }), today),
      1,
    );
    expect(updated?.name).toBe('Apollo 2');
    expect(updated?.endDate.toString()).toBe('2027-01-31');
    expect(updated?.version).toBe(2);
    expect(updated?.chargeCode.toString()).toBe(saved.chargeCode.toString());
  });

  it('updates 0 rows for a stale version', async () => {
    const saved = await repository().insert(newProject('Apollo'));
    const edit = saved.update(inputFrom(saved, { name: 'Apollo 2' }), today);
    await repository().update(edit, 1);
    expect(await repository().update(edit, 1)).toBeNull();
  });

  it('updates 0 rows for a deleted project', async () => {
    const saved = await repository().insert(newProject('Apollo'));
    await repository().softDelete(saved.id);
    expect(await repository().update(saved.update(inputFrom(saved), today), 1)).toBeNull();
  });

  it("rejects another active project's name in different case", async () => {
    await repository().insert(newProject('Gemini'));
    const saved = await repository().insert(newProject('Apollo'));
    await expect(
      repository().update(saved.update(inputFrom(saved, { name: 'GEMINI' }), today), 1),
    ).rejects.toBeInstanceOf(ProjectNameTakenError);
  });

  it("allows a deleted project's name", async () => {
    const deleted = await repository().insert(newProject('Gemini'));
    await repository().softDelete(deleted.id);
    const saved = await repository().insert(newProject('Apollo'));
    const updated = await repository().update(
      saved.update(inputFrom(saved, { name: 'Gemini' }), today),
      1,
    );
    expect(updated?.name).toBe('Gemini');
  });

  it('lets exactly one of two concurrent updates with the same version succeed', async () => {
    const saved = await repository().insert(newProject('Apollo'));
    const results = await Promise.all([
      repository().update(saved.update(inputFrom(saved, { name: 'First' }), today), 1),
      repository().update(saved.update(inputFrom(saved, { name: 'Second' }), today), 1),
    ]);
    expect(results.filter((r) => r !== null)).toHaveLength(1);
  });
});
