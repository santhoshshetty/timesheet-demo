import { CalendarDate } from '../../../src/domain/project/CalendarDate';
import { ChargeCode } from '../../../src/domain/project/ChargeCode';
import { ProjectValidationError } from '../../../src/domain/project/errors';
import { Project, type ProjectInput } from '../../../src/domain/project/Project';

const today = CalendarDate.of('2026-10-06');
const code = ChargeCode.of('00412345');
const requestId = '7b0f6c1e-3d2a-4f7e-9a51-2a4f0c9d8e11';

const valid: ProjectInput = {
  name: 'Apollo Migration',
  projectManager: { name: 'Priya Shah', email: 'priya.shah@example.com' },
  startDate: '2026-10-06',
  endDate: '2026-12-31',
  projectType: 'CLIENT',
  clientName: 'Contoso',
  billingType: 'BILLABLE',
};

function codesFor(input: ProjectInput): Array<[string, string]> {
  try {
    Project.create(input, today, code, requestId);
    return [];
  } catch (error) {
    if (!(error instanceof ProjectValidationError)) throw error;
    return error.errors.map((e) => [e.field, e.code]);
  }
}

describe('Project.create', () => {
  it('creates a new project with version 1 and the given charge code', () => {
    const project = Project.create(valid, today, code, requestId);
    expect(project.version).toBe(1);
    expect(project.chargeCode.toString()).toBe('00412345');
    expect(project.createRequestId).toBe(requestId);
  });

  it('accepts a start date of today and an end date equal to it', () => {
    expect(codesFor({ ...valid, startDate: '2026-10-06', endDate: '2026-10-06' })).toEqual([]);
  });

  it('rejects a start date before today', () => {
    expect(codesFor({ ...valid, startDate: '2026-10-05' })).toEqual([
      ['startDate', 'START_DATE_IN_PAST'],
    ]);
  });

  it('rejects an end date before the start date', () => {
    expect(codesFor({ ...valid, endDate: '2026-10-05' })).toEqual([
      ['endDate', 'END_BEFORE_START'],
    ]);
  });

  it('requires a client name for client projects', () => {
    expect(codesFor({ ...valid, clientName: '  ' })).toEqual([
      ['clientName', 'CLIENT_NAME_REQUIRED'],
    ]);
  });

  it('stores null as client name for internal projects', () => {
    const project = Project.create(
      { ...valid, projectType: 'INTERNAL', clientName: 'Ignored' },
      today,
      code,
      requestId,
    );
    expect(project.clientName).toBeNull();
  });

  it('enforces name and manager name lengths', () => {
    expect(codesFor({ ...valid, name: 'n'.repeat(101) })).toEqual([['name', 'TOO_LONG']]);
    expect(codesFor({ ...valid, name: '   ' })).toEqual([['name', 'REQUIRED']]);
    expect(
      codesFor({ ...valid, projectManager: { name: 'm'.repeat(101), email: 'a@b.com' } }),
    ).toEqual([['projectManager.name', 'TOO_LONG']]);
  });

  it('validates and normalizes the manager email', () => {
    expect(codesFor({ ...valid, projectManager: { name: 'Priya', email: 'bad' } })).toEqual([
      ['projectManager.email', 'INVALID_EMAIL'],
    ]);
    const project = Project.create(
      { ...valid, projectManager: { name: 'Priya', email: 'Priya@Example.COM' } },
      today,
      code,
      requestId,
    );
    expect(project.projectManager.email).toBe('priya@example.com');
  });

  it('reports several invalid fields together, including a past start date', () => {
    expect(
      codesFor({
        ...valid,
        name: '',
        startDate: '2026-10-01',
        projectType: 'CLIENT',
        clientName: '',
      }),
    ).toEqual([
      ['name', 'REQUIRED'],
      ['clientName', 'CLIENT_NAME_REQUIRED'],
      ['startDate', 'START_DATE_IN_PAST'],
    ]);
  });
});
