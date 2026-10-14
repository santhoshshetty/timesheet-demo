import { CalendarDate } from './CalendarDate';
import type { ChargeCode } from './ChargeCode';
import { EmailAddress } from './EmailAddress';
import {
  ProjectNotFoundError,
  ProjectValidationError,
  type FieldError,
  type FieldErrorCode,
} from './errors';
import { messageFor } from './messages';
import { MAX_NAME_LENGTH, ProjectName, parseRequiredText } from './ProjectName';

export const PROJECT_TYPES = ['INTERNAL', 'CLIENT'] as const;
export const BILLING_TYPES = ['BILLABLE', 'NON_BILLABLE'] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];
export type BillingType = (typeof BILLING_TYPES)[number];

/** Raw field values as received from a client. */
export interface ProjectInput {
  name: string;
  projectManager: { name: string; email: string };
  startDate: string;
  endDate: string;
  projectType: string;
  clientName?: string | null;
  billingType: string;
}

/** Validated and normalized field values. */
export interface ProjectFields {
  name: string;
  projectManager: { name: string; email: string };
  startDate: CalendarDate;
  endDate: CalendarDate;
  projectType: ProjectType;
  clientName: string | null;
  billingType: BillingType;
}

/** A validated project that has not been stored yet. */
export interface NewProject extends ProjectFields {
  chargeCode: ChargeCode;
  createRequestId: string;
  version: 1;
}

export interface ProjectSnapshot extends ProjectFields {
  id: string;
  chargeCode: ChargeCode;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  createRequestId: string;
}

/** Validates every field and reports all failures at once (FR-026). */
export function validateProjectFields(input: ProjectInput): ProjectFields {
  const errors: FieldError[] = [];
  const fail = (field: string, code: FieldErrorCode) =>
    errors.push({ field, code, message: messageFor(field, code) });

  const name = ProjectName.parse(input.name);
  if (!name.ok) fail('name', name.code);

  const managerName = parseRequiredText(input.projectManager?.name, MAX_NAME_LENGTH);
  if (!managerName.ok) fail('projectManager.name', managerName.code);

  const managerEmail = EmailAddress.parse(input.projectManager?.email);
  if (!managerEmail.ok) fail('projectManager.email', managerEmail.code);

  const startDate = parseDate(input.startDate);
  if (!startDate.ok) fail('startDate', startDate.code);

  const endDate = parseDate(input.endDate);
  if (!endDate.ok) fail('endDate', endDate.code);

  if (startDate.ok && endDate.ok && endDate.value.isBefore(startDate.value)) {
    fail('endDate', 'END_BEFORE_START');
  }

  const projectType = parseEnum(input.projectType, PROJECT_TYPES);
  if (!projectType.ok) fail('projectType', projectType.code);

  let clientName: string | null = null;
  if (projectType.ok && projectType.value === 'CLIENT') {
    const client = parseRequiredText(input.clientName, MAX_NAME_LENGTH);
    if (client.ok) clientName = client.value;
    else fail('clientName', client.code === 'REQUIRED' ? 'CLIENT_NAME_REQUIRED' : client.code);
  }

  const billingType = parseEnum(input.billingType, BILLING_TYPES);
  if (!billingType.ok) fail('billingType', billingType.code);

  if (
    errors.length > 0 ||
    !name.ok ||
    !managerName.ok ||
    !managerEmail.ok ||
    !startDate.ok ||
    !endDate.ok ||
    !projectType.ok ||
    !billingType.ok
  ) {
    throw new ProjectValidationError(errors);
  }

  return {
    name: name.value,
    projectManager: { name: managerName.value, email: managerEmail.value },
    startDate: startDate.value,
    endDate: endDate.value,
    projectType: projectType.value,
    clientName,
    billingType: billingType.value,
  };
}

export class Project {
  private constructor(private readonly state: ProjectSnapshot) {}

  /** Validates input for a new project; the Start Date must not be before `today` (FR-006a). */
  static create(
    input: ProjectInput,
    today: CalendarDate,
    chargeCode: ChargeCode,
    createRequestId: string,
  ): NewProject {
    const fields = validateWithRules(input, (start) =>
      start?.isBefore(today) ? [fieldError('startDate', 'START_DATE_IN_PAST')] : [],
    );
    return { ...fields, chargeCode, createRequestId, version: 1 };
  }

  /**
   * Applies an edit. The charge code never changes; a changed Start Date must not be before
   * `today` (FR-006a) and the End Date must not move earlier than its saved value (FR-006b).
   */
  update(input: ProjectInput, today: CalendarDate): Project {
    const fields = validateWithRules(input, (start, end) => {
      const errors: FieldError[] = [];
      if (start && !start.equals(this.state.startDate) && start.isBefore(today)) {
        errors.push(fieldError('startDate', 'START_DATE_IN_PAST'));
      }
      if (end?.isBefore(this.state.endDate)) {
        errors.push(fieldError('endDate', 'END_DATE_SHORTENED'));
      }
      return errors;
    });
    return new Project({ ...this.state, ...fields, version: this.state.version + 1 });
  }

  /** Soft delete: the data and charge code are kept (FR-021). */
  delete(now: Date): Project {
    if (this.isDeleted) throw new ProjectNotFoundError();
    return new Project({
      ...this.state,
      deletedAt: now,
      updatedAt: now,
      version: this.state.version + 1,
    });
  }

  static fromPersistence(snapshot: ProjectSnapshot): Project {
    return new Project({ ...snapshot });
  }

  get id(): string {
    return this.state.id;
  }
  get chargeCode(): ChargeCode {
    return this.state.chargeCode;
  }
  get name(): string {
    return this.state.name;
  }
  get projectManager(): { name: string; email: string } {
    return { ...this.state.projectManager };
  }
  get startDate(): CalendarDate {
    return this.state.startDate;
  }
  get endDate(): CalendarDate {
    return this.state.endDate;
  }
  get projectType(): ProjectType {
    return this.state.projectType;
  }
  get clientName(): string | null {
    return this.state.clientName;
  }
  get billingType(): BillingType {
    return this.state.billingType;
  }
  get version(): number {
    return this.state.version;
  }
  get createdAt(): Date {
    return this.state.createdAt;
  }
  get updatedAt(): Date {
    return this.state.updatedAt;
  }
  get deletedAt(): Date | null {
    return this.state.deletedAt;
  }
  get isDeleted(): boolean {
    return this.state.deletedAt !== null;
  }
  get createRequestId(): string {
    return this.state.createRequestId;
  }

  toSnapshot(): ProjectSnapshot {
    return { ...this.state, projectManager: { ...this.state.projectManager } };
  }
}

function fieldError(field: string, code: FieldErrorCode): FieldError {
  return { field, code, message: messageFor(field, code) };
}

/** Runs field validation plus date rules that need context, reporting all errors together. */
function validateWithRules(
  input: ProjectInput,
  dateRules: (start: CalendarDate | null, end: CalendarDate | null) => FieldError[],
): ProjectFields {
  let fields: ProjectFields | undefined;
  let errors: readonly FieldError[] = [];
  try {
    fields = validateProjectFields(input);
  } catch (error) {
    if (!(error instanceof ProjectValidationError)) throw error;
    errors = error.errors;
  }

  const asDate = (raw: unknown) => {
    const parsed = parseDate(raw);
    return parsed.ok ? parsed.value : null;
  };
  const start = fields?.startDate ?? asDate(input.startDate);
  const end = fields?.endDate ?? asDate(input.endDate);
  errors = [...errors, ...dateRules(start, end)];

  if (!fields || errors.length > 0) throw new ProjectValidationError(errors);
  return fields;
}

function parseDate(
  raw: unknown,
): { ok: true; value: CalendarDate } | { ok: false; code: FieldErrorCode } {
  if (typeof raw !== 'string' || raw.trim() === '') return { ok: false, code: 'REQUIRED' };
  const date = CalendarDate.parse(raw);
  return date ? { ok: true, value: date } : { ok: false, code: 'INVALID_DATE' };
}

function parseEnum<T extends string>(
  raw: unknown,
  allowed: readonly T[],
): { ok: true; value: T } | { ok: false; code: FieldErrorCode } {
  if (typeof raw !== 'string' || raw === '') return { ok: false, code: 'REQUIRED' };
  return (allowed as readonly string[]).includes(raw)
    ? { ok: true, value: raw as T }
    : { ok: false, code: 'INVALID_VALUE' };
}
