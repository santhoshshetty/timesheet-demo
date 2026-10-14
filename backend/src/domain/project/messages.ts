import type { FieldErrorCode } from './errors';

const FIELD_LABELS: Record<string, string> = {
  name: 'Project name',
  'projectManager.name': 'Project manager name',
  'projectManager.email': 'Project manager email',
  startDate: 'Start date',
  endDate: 'End date',
  projectType: 'Project type',
  clientName: 'Client name',
  billingType: 'Billing type',
};

const LIMITS: Record<string, number> = {
  name: 100,
  'projectManager.name': 100,
  'projectManager.email': 254,
  clientName: 100,
};

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

/** User-facing message for a field error; the frontend uses the same wording. */
export function messageFor(field: string, code: FieldErrorCode): string {
  const label = fieldLabel(field);
  switch (code) {
    case 'REQUIRED':
      return `${label} is required.`;
    case 'TOO_LONG':
      return `${label} must be ${LIMITS[field] ?? 100} characters or fewer.`;
    case 'INVALID_EMAIL':
      return 'Enter a valid email address.';
    case 'INVALID_DATE':
      return `${label} must be a valid date.`;
    case 'INVALID_VALUE':
      return `${label} has an invalid value.`;
    case 'START_DATE_IN_PAST':
      return 'Start date cannot be in the past.';
    case 'END_BEFORE_START':
      return 'End date must be on or after the start date.';
    case 'END_DATE_SHORTENED':
      return 'End date cannot be moved earlier than its current value.';
    case 'CLIENT_NAME_REQUIRED':
      return 'Client name is required for Client Projects.';
  }
}
