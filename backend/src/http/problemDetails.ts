import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { FieldError, Problem } from '@timesheet/api-contract';
import {
  ChargeCodeUnavailableError,
  ProjectNameTakenError,
  ProjectNotFoundError,
  ProjectValidationError,
  VersionConflictError,
  type FieldErrorCode,
} from '../domain/project/errors';
import { fieldLabel, messageFor } from '../domain/project/messages';
import type { Logger } from '../infrastructure/logging/logger';
import { InvalidIfMatchError, PreconditionRequiredError, RouteNotFoundError } from './httpErrors';
import { getRequestId } from './requestId';

type ProblemCode = Problem['code'];
type ContractFieldCode = FieldError['code'];

const TITLES: Record<ProblemCode, string> = {
  VALIDATION_FAILED: 'Request validation failed',
  BUSINESS_RULE_VIOLATION: 'Project data is not valid',
  PROJECT_NOT_FOUND: 'Project not found',
  PROJECT_NAME_TAKEN: 'Project name already in use',
  VERSION_CONFLICT: 'Project was changed by someone else',
  PRECONDITION_REQUIRED: 'If-Match header required',
  CHARGE_CODE_UNAVAILABLE: 'Charge code unavailable',
  ROUTE_NOT_FOUND: 'Not found',
  METHOD_NOT_ALLOWED: 'Method not allowed',
  INTERNAL_ERROR: 'Something went wrong',
};

const DOMAIN_CODES: ReadonlySet<string> = new Set<FieldErrorCode>([
  'REQUIRED',
  'TOO_LONG',
  'INVALID_EMAIL',
  'INVALID_DATE',
  'INVALID_VALUE',
]);

interface ProblemResponse {
  status: number;
  body: Problem;
  headers?: Record<string, string>;
}

interface ValidatorErrorItem {
  path: string;
  message: string;
  errorCode?: string;
}

interface ValidatorError {
  status: number;
  errors: ValidatorErrorItem[];
  headers?: Record<string, string>;
}

function problem(
  status: number,
  code: ProblemCode,
  requestId: string,
  extra: { detail?: string; errors?: FieldError[] } = {},
): Problem {
  return { type: 'about:blank', title: TITLES[code], status, code, requestId, ...extra };
}

export function toProblem(error: unknown, requestId: string): ProblemResponse {
  if (error instanceof ProjectValidationError) {
    return {
      status: 422,
      body: problem(422, 'BUSINESS_RULE_VIOLATION', requestId, {
        errors: error.errors.map(({ field, code, message }) => ({ field, code, message })),
      }),
    };
  }
  if (error instanceof ProjectNotFoundError) {
    return { status: 404, body: problem(404, 'PROJECT_NOT_FOUND', requestId) };
  }
  if (error instanceof ProjectNameTakenError) {
    return {
      status: 409,
      body: problem(409, 'PROJECT_NAME_TAKEN', requestId, {
        errors: [
          {
            field: 'name',
            code: 'INVALID_VALUE',
            message: 'A project with this name already exists.',
          },
        ],
      }),
    };
  }
  if (error instanceof VersionConflictError) {
    return {
      status: 412,
      body: problem(412, 'VERSION_CONFLICT', requestId, {
        detail: 'Reload the project to see the latest changes, then try again.',
      }),
    };
  }
  if (error instanceof PreconditionRequiredError) {
    return {
      status: 428,
      body: problem(428, 'PRECONDITION_REQUIRED', requestId, {
        detail: "Send the project's current ETag in the If-Match header.",
      }),
    };
  }
  if (error instanceof InvalidIfMatchError) {
    return {
      status: 400,
      body: problem(400, 'VALIDATION_FAILED', requestId, {
        errors: [
          {
            field: 'If-Match',
            code: 'INVALID_FORMAT',
            message: 'If-Match must be the quoted version from the ETag, e.g. "3".',
          },
        ],
      }),
    };
  }
  if (error instanceof ChargeCodeUnavailableError) {
    return {
      status: 503,
      body: problem(503, 'CHARGE_CODE_UNAVAILABLE', requestId, {
        detail: 'The project could not be created. Please try again.',
      }),
    };
  }
  if (error instanceof RouteNotFoundError) {
    return { status: 404, body: problem(404, 'ROUTE_NOT_FOUND', requestId) };
  }
  if (isBodyParserError(error)) {
    const detail =
      error.type === 'entity.too.large'
        ? 'Request body is too large.'
        : 'Request body is not valid JSON.';
    return { status: 400, body: problem(400, 'VALIDATION_FAILED', requestId, { detail }) };
  }
  if (isValidatorError(error)) {
    return fromValidatorError(error, requestId);
  }
  return internalError(requestId);
}

function internalError(requestId: string): ProblemResponse {
  return {
    status: 500,
    body: problem(500, 'INTERNAL_ERROR', requestId, {
      detail: 'Please try again. If the problem continues, contact support with the request ID.',
    }),
  };
}

function fromValidatorError(error: ValidatorError, requestId: string): ProblemResponse {
  switch (error.status) {
    case 404:
      return { status: 404, body: problem(404, 'ROUTE_NOT_FOUND', requestId) };
    case 405:
      return {
        status: 405,
        body: problem(405, 'METHOD_NOT_ALLOWED', requestId),
        headers: error.headers?.Allow ? { Allow: error.headers.Allow } : undefined,
      };
    case 400:
    case 415:
      return {
        status: 400,
        body: problem(400, 'VALIDATION_FAILED', requestId, {
          errors: dedupe(error.errors.map(toFieldError)),
        }),
      };
    default:
      return internalError(requestId);
  }
}

function toFieldError(item: ValidatorErrorItem): FieldError {
  const field = toFieldName(item.path);
  const code = toFieldCode(item);
  return { field, code, message: fieldMessage(field, code) };
}

function toFieldName(path: string): string {
  const [, location = '', ...rest] = path.split('/');
  if (location === 'headers') {
    return (rest[0] ?? '').replace(
      /(^|-)([a-z])/g,
      (_m, dash: string, c: string) => dash + c.toUpperCase(),
    );
  }
  if (rest.length === 0) return location;
  return rest.join('.');
}

function toFieldCode({ errorCode = '', message }: ValidatorErrorItem): ContractFieldCode {
  const keyword = errorCode.split('.')[0];
  switch (keyword) {
    case 'required':
    case 'minLength':
      return 'REQUIRED';
    case 'maxLength':
      return 'TOO_LONG';
    case 'additionalProperties':
    case 'unevaluatedProperties':
      return 'UNKNOWN_FIELD';
    case 'enum':
    case 'minimum':
    case 'maximum':
    case 'pattern':
      return 'INVALID_VALUE';
    case 'format':
      if (message.includes('"date"')) return 'INVALID_DATE';
      if (message.includes('"email"')) return 'INVALID_EMAIL';
      return 'INVALID_FORMAT';
    default:
      return 'INVALID_FORMAT';
  }
}

function fieldMessage(field: string, code: ContractFieldCode): string {
  if (code === 'UNKNOWN_FIELD') {
    return field === 'chargeCode'
      ? 'Charge code is generated by the system and cannot be supplied.'
      : `${field} is not a recognised field.`;
  }
  if (DOMAIN_CODES.has(code)) return messageFor(field, code as FieldErrorCode);
  return `${fieldLabel(field)} has an invalid format.`;
}

function dedupe(errors: FieldError[]): FieldError[] {
  const seen = new Set<string>();
  return errors.filter(({ field, code }) => {
    const key = `${field}|${code}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isValidatorError(error: unknown): error is ValidatorError {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as Partial<ValidatorError>;
  return typeof candidate.status === 'number' && Array.isArray(candidate.errors);
}

function isBodyParserError(error: unknown): error is { type: string } {
  if (typeof error !== 'object' || error === null) return false;
  const { type } = error as { type?: unknown };
  return type === 'entity.too.large' || type === 'entity.parse.failed';
}

export const notFound: RequestHandler = (_req, _res, next) => {
  next(new RouteNotFoundError());
};

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, _req, res, _next) => {
    const requestId = getRequestId(res.locals);
    const { status, body, headers } = toProblem(error, requestId);
    if (status >= 500) {
      logger.error('Request failed', { requestId, err: error });
    }
    if (headers) res.set(headers);
    // `send` (not `json`) keeps error bodies out of the OpenAPI response validator.
    res.status(status).type('application/problem+json').send(JSON.stringify(body));
  };
}
