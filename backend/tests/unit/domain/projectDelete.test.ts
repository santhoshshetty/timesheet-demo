import { CalendarDate } from '../../../src/domain/project/CalendarDate';
import { ChargeCode } from '../../../src/domain/project/ChargeCode';
import { ProjectNotFoundError } from '../../../src/domain/project/errors';
import { Project } from '../../../src/domain/project/Project';

const active = Project.fromPersistence({
  id: '0b6f7c1e-3d2a-4f7e-9a51-2a4f0c9d8e11',
  chargeCode: ChargeCode.of('00412345'),
  name: 'Apollo',
  projectManager: { name: 'Priya Shah', email: 'priya.shah@example.com' },
  startDate: CalendarDate.of('2026-10-06'),
  endDate: CalendarDate.of('2026-12-31'),
  projectType: 'INTERNAL',
  clientName: null,
  billingType: 'BILLABLE',
  version: 2,
  createdAt: new Date('2026-10-06T00:00:00Z'),
  updatedAt: new Date('2026-10-06T00:00:00Z'),
  deletedAt: null,
  createRequestId: '7b0f6c1e-3d2a-4f7e-9a51-2a4f0c9d8e11',
});

describe('Project.delete', () => {
  const now = new Date('2026-10-07T09:00:00Z');

  it('sets deletedAt, keeps the charge code, and increments the version', () => {
    const deleted = active.delete(now);
    expect(deleted.deletedAt).toEqual(now);
    expect(deleted.isDeleted).toBe(true);
    expect(deleted.chargeCode.toString()).toBe('00412345');
    expect(deleted.version).toBe(3);
  });

  it('cannot delete a project twice', () => {
    expect(() => active.delete(now).delete(now)).toThrow(ProjectNotFoundError);
  });
});
