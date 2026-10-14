import type { FieldError } from '@timesheet/api-contract';

export interface ApiProblem {
  status: number;
  code: string;
  title: string;
  detail?: string;
  requestId?: string;
  errors: FieldError[];
}

export class ApiError extends Error {
  constructor(readonly problem: ApiProblem) {
    super(problem.title);
    this.name = 'ApiError';
  }
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Pick<Headers, 'get'>;
}

interface RequestOptions {
  body?: unknown;
  headers?: Record<string, string>;
}

const NETWORK_ERROR: ApiProblem = {
  status: 0,
  code: 'NETWORK_ERROR',
  title: 'The service could not be reached',
  detail: 'Check your connection and try again.',
  errors: [],
};

export async function request<T>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = { Accept: 'application/json', ...options.headers };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(NETWORK_ERROR);
  }

  if (!response.ok) {
    throw new ApiError(await toProblem(response));
  }
  const data = (response.status === 204 ? undefined : await response.json()) as T;
  return { data, status: response.status, headers: response.headers };
}

async function toProblem(response: Response): Promise<ApiProblem> {
  const fallback: ApiProblem = {
    status: response.status,
    code: 'UNEXPECTED_RESPONSE',
    title: 'Something went wrong',
    detail: 'Please try again.',
    errors: [],
  };
  if (!response.headers.get('content-type')?.includes('application/problem+json')) {
    return fallback;
  }
  try {
    const body = (await response.json()) as Partial<ApiProblem>;
    return {
      ...fallback,
      ...body,
      status: response.status,
      errors: Array.isArray(body.errors) ? body.errors : [],
    };
  } catch {
    return fallback;
  }
}
