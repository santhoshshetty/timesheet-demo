import { render } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { NotificationProvider } from '../../src/app/NotificationProvider';
import { routes } from '../../src/app/routes';
import { theme } from '../../src/app/theme';

/** Renders the real route tree at `path` with all app providers. */
export function renderRoute(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const utils = render(
    <ThemeProvider theme={theme}>
      <NotificationProvider>
        <RouterProvider router={router} />
      </NotificationProvider>
    </ThemeProvider>,
  );
  return { ...utils, router };
}

export interface MockResponse {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface RecordedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

type Responder = (request: RecordedRequest) => MockResponse | Promise<MockResponse>;

export interface Handler {
  method: string;
  path: string | RegExp;
  respond: Responder;
}

/** Replaces global fetch; unmatched requests fail the test loudly. */
export function mockFetch(handlers: Handler[]) {
  const requests: RecordedRequest[] = [];
  const fetchMock = jest.fn(async (url: string, init: RequestInit = {}) => {
    const recorded: RecordedRequest = {
      url,
      method: init.method ?? 'GET',
      headers: (init.headers ?? {}) as Record<string, string>,
      body: typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
    };
    requests.push(recorded);
    const handler = handlers.find(
      (h) =>
        h.method === recorded.method &&
        (typeof h.path === 'string' ? h.path === url : h.path.test(url)),
    );
    if (!handler) throw new Error(`Unhandled request: ${recorded.method} ${url}`);
    const response = await handler.respond(recorded);
    const headers = new Map(
      Object.entries(response.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]),
    );
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
      json: () => Promise.resolve(response.body),
    };
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return { fetchMock, requests };
}

export function networkFailure(): never {
  throw new TypeError('Failed to fetch');
}

export function problem(
  status: number,
  code: string,
  errors: Array<{ field: string; code: string; message: string }> = [],
): MockResponse {
  return {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
    body: { type: 'about:blank', title: code, status, code, requestId: 'req-123', errors },
  };
}

export const sampleProject = {
  id: '3f0c6a52-1b7e-4a4d-9d38-5c1f0a2b7e11',
  chargeCode: '00412345',
  name: 'Apollo Migration',
  projectManager: { name: 'Priya Shah', email: 'priya.shah@example.com' },
  startDate: '2099-01-05',
  endDate: '2099-03-31',
  projectType: 'CLIENT',
  clientName: 'Contoso',
  billingType: 'BILLABLE',
  version: 1,
  createdAt: '2026-10-06T12:00:00.000Z',
  updatedAt: '2026-10-06T12:00:00.000Z',
} as const;
