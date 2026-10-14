import { CalendarDate } from '../../../src/domain/project/CalendarDate';
import { ChargeCode } from '../../../src/domain/project/ChargeCode';
import { ProjectValidationError } from '../../../src/domain/project/errors';
import { Project, type ProjectInput } from '../../../src/domain/project/Project';

const today = CalendarDate.of('2026-10-06');

const saved = Project.fromPersistence({
  id: '0b6f7c1e-3d2a-4f7e-9a51-2a4f0c9d8e11',
  chargeCode: ChargeCode.of('00412345'),
  name: 'Apollo Migration',
  projectManager: { name: 'Priya Shah', email: 'priya.shah@example.com' },
  startDate: CalendarDate.of('2026-09-01'),
  endDate: CalendarDate.of('2026-12-31'),
  projectType: 'CLIENT',
  clientName: 'Contoso',
  billingType: 'BILLABLE',
  version: 3,
  createdAt: new Date('2026-09-01T00:00:00Z'),
  updatedAt: new Date('2026-09-01T00:00:00Z'),
  deletedAt: null,
  createRequestId: '7b0f6c1e-3d2a-4f7e-9a51-2a4f0c9d8e11',
});

const unchanged: ProjectInput = {
  name: saved.name,
  projectManager: saved.projectManager,
  startDate: '2026-09-01',
  endDate: '2026-12-31',
  projectType: 'CLIENT',
  clientName: 'Contoso',
  billingType: 'BILLABLE',
};

function codesFor(input: ProjectInput): Array<[string, string]> {
  try {
    saved.update(input, today);
    return [];
  } catch (error) {
    if (!(error instanceof ProjectValidationError)) throw error;
    return error.errors.map((e) => [e.field, e.code]);
  }
}

describe('Project.update', () => {
  it('keeps the charge code and increments the version', () => {
    const updated = saved.update({ ...unchanged, name: 'Apollo Phase 2' }, today);
    expect(updated.chargeCode.toString()).toBe('00412345');
    expect(updated.name).toBe('Apollo Phase 2');
    expect(updated.version).toBe(4);
  });

  it('accepts an unchanged start date that is already in the past', () => {
    expect(codesFor(unchanged)).toEqual([]);
  });

  it('rejects a changed start date before today', () => {
    expect(codesFor({ ...unchanged, startDate: '2026-09-02' })).toEqual([
      ['startDate', 'START_DATE_IN_PAST'],
    ]);
  });

  it('accepts a changed start date of today or later', () => {
    expect(codesFor({ ...unchanged, startDate: '2026-10-06' })).toEqual([]);
  });

  it('rejects an end date earlier than the saved end date', () => {
    expect(codesFor({ ...unchanged, endDate: '2026-12-30' })).toEqual([
      ['endDate', 'END_DATE_SHORTENED'],
    ]);
  });

  it('accepts an extended end date', () => {
    expect(saved.update({ ...unchanged, endDate: '2027-03-31' }, today).endDate.toString()).toBe(
      '2027-03-31',
    );
  });

  it('rejects an end date before the new start date', () => {
    expect(codesFor({ ...unchanged, startDate: '2027-02-01', endDate: '2027-01-31' })).toEqual([
      ['endDate', 'END_BEFORE_START'],
    ]);
  });

  it('clears the client name when changing to an internal project', () => {
    expect(saved.update({ ...unchanged, projectType: 'INTERNAL' }, today).clientName).toBeNull();
  });

  it('requires a client name when changing to a client project', () => {
    const internal = saved.update({ ...unchanged, projectType: 'INTERNAL' }, today);
    expect(() =>
      internal.update({ ...unchanged, projectType: 'CLIENT', clientName: '' }, today),
    ).toThrow(ProjectValidationError);
  });
});
