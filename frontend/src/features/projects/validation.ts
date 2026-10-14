import type {
  BillingType,
  FieldError,
  Project,
  ProjectInput,
  ProjectType,
} from '@timesheet/api-contract';

export type ProjectField =
  | 'name'
  | 'projectType'
  | 'clientName'
  | 'projectManager.name'
  | 'projectManager.email'
  | 'startDate'
  | 'endDate'
  | 'billingType';

/** Display order, used for the error summary. */
export const PROJECT_FIELDS: readonly ProjectField[] = [
  'name',
  'projectType',
  'clientName',
  'projectManager.name',
  'projectManager.email',
  'startDate',
  'endDate',
  'billingType',
];

export interface ProjectFormValues {
  name: string;
  projectType: ProjectType | '';
  clientName: string;
  projectManagerName: string;
  projectManagerEmail: string;
  startDate: string;
  endDate: string;
  billingType: BillingType | '';
}

export const EMPTY_PROJECT_FORM: ProjectFormValues = {
  name: '',
  projectType: '',
  clientName: '',
  projectManagerName: '',
  projectManagerEmail: '',
  startDate: '',
  endDate: '',
  billingType: '',
};

export type FieldErrors = Partial<Record<ProjectField, string>>;

const MAX_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
// Same pattern the server uses (ajv-formats "fast" email).
const EMAIL_PATTERN =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Wording matches the server's messages (backend/src/domain/project/messages.ts).
export const MESSAGES = {
  nameRequired: 'Project name is required.',
  nameTooLong: 'Project name must be 100 characters or fewer.',
  projectTypeRequired: 'Project type is required.',
  clientNameRequired: 'Client name is required for Client Projects.',
  clientNameTooLong: 'Client name must be 100 characters or fewer.',
  managerNameRequired: 'Project manager name is required.',
  managerNameTooLong: 'Project manager name must be 100 characters or fewer.',
  managerEmailRequired: 'Project manager email is required.',
  managerEmailTooLong: 'Project manager email must be 254 characters or fewer.',
  managerEmailInvalid: 'Enter a valid email address.',
  startDateRequired: 'Start date is required.',
  startDateInvalid: 'Start date must be a valid date.',
  endDateRequired: 'End date is required.',
  endDateInvalid: 'End date must be a valid date.',
  endBeforeStart: 'End date must be on or after the start date.',
  billingTypeRequired: 'Billing type is required.',
  startDateInPastHint:
    'This start date is before today. Start dates cannot be in the past; the server will check it when you save.',
} as const;

export function fieldId(field: ProjectField): string {
  return `project-${field.replace('.', '-')}`;
}

function isRealDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 0));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day
  );
}

function requiredText(
  value: string,
  max: number,
  required: string,
  tooLong: string,
): string | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return required;
  if (trimmed.length > max) return tooLong;
  return undefined;
}

/** Client-side checks for fast feedback; the server remains authoritative. */
export function validateProjectForm(values: ProjectFormValues): FieldErrors {
  const errors: FieldErrors = {};
  const set = (field: ProjectField, message: string | undefined) => {
    if (message) errors[field] = message;
  };

  set('name', requiredText(values.name, MAX_LENGTH, MESSAGES.nameRequired, MESSAGES.nameTooLong));
  set('projectType', values.projectType ? undefined : MESSAGES.projectTypeRequired);
  if (values.projectType === 'CLIENT') {
    set(
      'clientName',
      requiredText(
        values.clientName,
        MAX_LENGTH,
        MESSAGES.clientNameRequired,
        MESSAGES.clientNameTooLong,
      ),
    );
  }
  set(
    'projectManager.name',
    requiredText(
      values.projectManagerName,
      MAX_LENGTH,
      MESSAGES.managerNameRequired,
      MESSAGES.managerNameTooLong,
    ),
  );

  const email = values.projectManagerEmail.trim();
  if (email === '') set('projectManager.email', MESSAGES.managerEmailRequired);
  else if (email.length > MAX_EMAIL_LENGTH)
    set('projectManager.email', MESSAGES.managerEmailTooLong);
  else if (!EMAIL_PATTERN.test(email)) set('projectManager.email', MESSAGES.managerEmailInvalid);

  if (values.startDate === '') set('startDate', MESSAGES.startDateRequired);
  else if (!isRealDate(values.startDate)) set('startDate', MESSAGES.startDateInvalid);

  if (values.endDate === '') set('endDate', MESSAGES.endDateRequired);
  else if (!isRealDate(values.endDate)) set('endDate', MESSAGES.endDateInvalid);
  else if (!errors.startDate && values.endDate < values.startDate) {
    set('endDate', MESSAGES.endBeforeStart);
  }

  set('billingType', values.billingType ? undefined : MESSAGES.billingTypeRequired);
  return errors;
}

/** Non-blocking hint: the browser's date may differ from the business time zone (FR-006a). */
export function startDateHint(values: ProjectFormValues, today: string): string | undefined {
  return isRealDate(values.startDate) && values.startDate < today
    ? MESSAGES.startDateInPastHint
    : undefined;
}

export function toFormValues(project: Project): ProjectFormValues {
  return {
    name: project.name,
    projectType: project.projectType,
    clientName: project.clientName ?? '',
    projectManagerName: project.projectManager.name,
    projectManagerEmail: project.projectManager.email,
    startDate: project.startDate,
    endDate: project.endDate,
    billingType: project.billingType,
  };
}

export function toProjectInput(values: ProjectFormValues): ProjectInput {
  return {
    name: values.name.trim(),
    projectManager: {
      name: values.projectManagerName.trim(),
      email: values.projectManagerEmail.trim(),
    },
    startDate: values.startDate,
    endDate: values.endDate,
    projectType: values.projectType as ProjectType,
    clientName: values.projectType === 'CLIENT' ? values.clientName.trim() : null,
    billingType: values.billingType as BillingType,
  };
}

/** Maps server field errors onto form fields; returns null when none match a form field. */
export function toFieldErrors(errors: readonly FieldError[]): FieldErrors | null {
  const result: FieldErrors = {};
  for (const error of errors) {
    if ((PROJECT_FIELDS as readonly string[]).includes(error.field)) {
      result[error.field as ProjectField] ??= error.message;
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}
