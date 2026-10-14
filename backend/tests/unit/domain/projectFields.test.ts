import { ProjectValidationError } from '../../../src/domain/project/errors';
import { validateProjectFields, type ProjectInput } from '../../../src/domain/project/Project';

const valid: ProjectInput = {
  name: 'Apollo Migration',
  projectManager: { name: 'Priya Shah', email: 'priya.shah@example.com' },
  startDate: '2026-10-06',
  endDate: '2026-12-31',
  projectType: 'CLIENT',
  clientName: 'Contoso',
  billingType: 'BILLABLE',
};

function errorsFor(input: ProjectInput) {
  try {
    validateProjectFields(input);
  } catch (error) {
    if (error instanceof ProjectValidationError) return error.errors;
    throw error;
  }
  return [];
}

describe('validateProjectFields', () => {
  it('returns normalized fields for valid input', () => {
    const fields = validateProjectFields({
      ...valid,
      name: '  Apollo Migration ',
      projectManager: { name: ' Priya Shah ', email: ' Priya.Shah@Example.com ' },
      clientName: ' Contoso ',
    });
    expect(fields.name).toBe('Apollo Migration');
    expect(fields.projectManager).toEqual({ name: 'Priya Shah', email: 'priya.shah@example.com' });
    expect(fields.clientName).toBe('Contoso');
    expect(fields.startDate.toString()).toBe('2026-10-06');
  });

  it('reports all errors at once', () => {
    const errors = errorsFor({
      name: ' ',
      projectManager: { name: 'x'.repeat(101), email: 'bad' },
      startDate: '2026-02-31',
      endDate: '',
      projectType: 'CLIENT',
      clientName: '',
      billingType: 'NONE',
    });
    expect(errors.map((e) => [e.field, e.code])).toEqual([
      ['name', 'REQUIRED'],
      ['projectManager.name', 'TOO_LONG'],
      ['projectManager.email', 'INVALID_EMAIL'],
      ['startDate', 'INVALID_DATE'],
      ['endDate', 'REQUIRED'],
      ['clientName', 'CLIENT_NAME_REQUIRED'],
      ['billingType', 'INVALID_VALUE'],
    ]);
    expect(errors.every((e) => e.message.length > 0)).toBe(true);
  });

  it('rejects an end date before the start date', () => {
    expect(errorsFor({ ...valid, endDate: '2026-10-05' })).toEqual([
      expect.objectContaining({ field: 'endDate', code: 'END_BEFORE_START' }),
    ]);
  });

  it('accepts an end date equal to the start date', () => {
    expect(errorsFor({ ...valid, endDate: valid.startDate })).toEqual([]);
  });

  it('rejects a client name longer than 100 characters', () => {
    expect(errorsFor({ ...valid, clientName: 'c'.repeat(101) })).toEqual([
      expect.objectContaining({ field: 'clientName', code: 'TOO_LONG' }),
    ]);
  });

  it('discards a client name for internal projects', () => {
    const fields = validateProjectFields({ ...valid, projectType: 'INTERNAL', clientName: 'X' });
    expect(fields.clientName).toBeNull();
  });

  it.each([
    ['INTERNAL', 'BILLABLE'],
    ['INTERNAL', 'NON_BILLABLE'],
    ['CLIENT', 'BILLABLE'],
    ['CLIENT', 'NON_BILLABLE'],
  ])('allows %s with %s (FR-005)', (projectType, billingType) => {
    expect(errorsFor({ ...valid, projectType, billingType })).toEqual([]);
  });
});
