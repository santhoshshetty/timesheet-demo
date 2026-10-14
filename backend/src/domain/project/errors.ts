export type FieldErrorCode =
  | 'REQUIRED'
  | 'TOO_LONG'
  | 'INVALID_EMAIL'
  | 'INVALID_DATE'
  | 'INVALID_VALUE'
  | 'START_DATE_IN_PAST'
  | 'END_BEFORE_START'
  | 'END_DATE_SHORTENED'
  | 'CLIENT_NAME_REQUIRED';

export interface FieldError {
  field: string;
  code: FieldErrorCode;
  message: string;
}

export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ProjectValidationError extends DomainError {
  constructor(readonly errors: readonly FieldError[]) {
    super('Project data is not valid');
  }
}

export class ProjectNotFoundError extends DomainError {
  constructor() {
    super('Project not found');
  }
}

export class ProjectNameTakenError extends DomainError {
  constructor() {
    super('Project name already in use');
  }
}

export class VersionConflictError extends DomainError {
  constructor() {
    super('Project was changed by someone else');
  }
}

export class ChargeCodeUnavailableError extends DomainError {
  constructor() {
    super('A unique charge code could not be generated');
  }
}

/** Raised by repositories when a generated charge code already exists; the use case retries. */
export class ChargeCodeCollisionError extends DomainError {
  constructor() {
    super('Charge code already assigned');
  }
}

/** Raised by repositories when a create request with the same idempotency key already exists. */
export class DuplicateCreateRequestError extends DomainError {
  constructor() {
    super('Create request already processed');
  }
}
