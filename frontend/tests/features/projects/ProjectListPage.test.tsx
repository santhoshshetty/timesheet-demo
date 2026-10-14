import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import {
  mockFetch,
  networkFailure,
  problem,
  renderRoute,
  sampleProject,
  type RecordedRequest,
} from '../../support/render';

const LIST = /^\/api\/v1\/projects(\?.*)?$/;

function page(items: unknown[], overrides: Record<string, number> = {}) {
  return {
    status: 200,
    body: {
      items,
      page: 1,
      pageSize: 25,
      totalItems: items.length,
      totalPages: items.length > 0 ? 1 : 0,
      ...overrides,
    },
  };
}

const second = {
  ...sampleProject,
  id: '9a1c6a52-1b7e-4a4d-9d38-5c1f0a2b7e22',
  name: 'Gemini',
  chargeCode: '87654321',
  projectType: 'INTERNAL',
  clientName: null,
  billingType: 'NON_BILLABLE',
};

const queryOf = (request: RecordedRequest) =>
  Object.fromEntries(new URL(request.url, 'http://localhost').searchParams);

describe('ProjectListPage', () => {
  it('shows the project columns, links to details, and has no axe violations', async () => {
    mockFetch([{ method: 'GET', path: LIST, respond: () => page([sampleProject, second]) }]);
    const { container } = renderRoute('/projects');

    const table = await screen.findByRole('table');
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((h) => h.textContent);
    expect(headers).toEqual([
      expect.stringContaining('Project name'),
      expect.stringContaining('Charge code'),
      'Project manager',
      expect.stringContaining('Start date'),
      expect.stringContaining('End date'),
      'Project type',
      'Billing type',
    ]);
    const row = within(table).getByRole('link', { name: 'Apollo Migration' }).closest('tr');
    expect(row).not.toBeNull();
    const cells = within(row as HTMLElement)
      .getAllByRole('cell')
      .map((c) => c.textContent);
    expect(cells).toEqual([
      'Apollo Migration',
      '00412345',
      'Priya Shah',
      '05 Jan 2099',
      '31 Mar 2099',
      'Client Project',
      'Billable',
    ]);
    expect(within(table).getByRole('link', { name: 'Apollo Migration' })).toHaveAttribute(
      'href',
      `/projects/${sampleProject.id}`,
    );
    expect(document.title).toBe('Projects – timesheet-demo');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows a loading state', async () => {
    mockFetch([{ method: 'GET', path: LIST, respond: () => new Promise(() => undefined) }]);
    renderRoute('/projects');
    expect(await screen.findByText('Loading projects…')).toBeInTheDocument();
  });

  it('shows an empty state with a Create project action when there are no projects', async () => {
    mockFetch([{ method: 'GET', path: LIST, respond: () => page([]) }]);
    renderRoute('/projects');
    const heading = await screen.findByRole('heading', { name: 'No projects yet' });
    const emptyState = heading.parentElement as HTMLElement;
    expect(within(emptyState).getByRole('link', { name: 'Create project' })).toHaveAttribute(
      'href',
      '/projects/new',
    );
  });

  it('shows "No matching projects" with Clear search when a search has no results', async () => {
    const { requests } = mockFetch([
      {
        method: 'GET',
        path: LIST,
        respond: (req) => (queryOf(req).search ? page([]) : page([sampleProject])),
      },
    ]);
    const user = userEvent.setup();
    const { router } = renderRoute('/projects?search=zzz');

    expect(await screen.findByRole('heading', { name: 'No matching projects' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(await screen.findByRole('link', { name: 'Apollo Migration' })).toBeInTheDocument();
    expect(screen.getByLabelText('Search projects')).toHaveValue('');
    expect(router.state.location.search).toBe('');
    expect(queryOf(requests.at(-1) as RecordedRequest).search).toBeUndefined();
  });

  it('shows an error state and retries', async () => {
    let calls = 0;
    mockFetch([
      {
        method: 'GET',
        path: LIST,
        respond: () => {
          calls += 1;
          if (calls === 1) networkFailure();
          return page([sampleProject]);
        },
      },
    ]);
    const user = userEvent.setup();
    renderRoute('/projects');
    expect(await screen.findByText('Projects could not be loaded')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('link', { name: 'Apollo Migration' })).toBeInTheDocument();
  });

  it('searches after a pause while typing and reflects the term in the URL', async () => {
    const { requests } = mockFetch([
      { method: 'GET', path: LIST, respond: () => page([sampleProject]) },
    ]);
    const user = userEvent.setup();
    const { router } = renderRoute('/projects');
    await screen.findByRole('table');

    await user.type(screen.getByLabelText('Search projects'), 'conto');
    expect(requests.filter((r) => queryOf(r).search)).toHaveLength(0);
    await waitFor(() => expect(router.state.location.search).toBe('?search=conto'));
    await waitFor(() => expect(queryOf(requests.at(-1) as RecordedRequest).search).toBe('conto'));
    expect(requests.filter((r) => queryOf(r).search)).toHaveLength(1);
  });

  it('searches immediately on Enter', async () => {
    const { requests } = mockFetch([
      { method: 'GET', path: LIST, respond: () => page([sampleProject]) },
    ]);
    const user = userEvent.setup();
    renderRoute('/projects');
    await screen.findByRole('table');
    await user.type(screen.getByLabelText('Search projects'), '0041{Enter}');
    await waitFor(() => expect(queryOf(requests.at(-1) as RecordedRequest).search).toBe('0041'));
  });

  it('sorts by a column with aria-sort and reflects it in the URL', async () => {
    const { requests } = mockFetch([
      { method: 'GET', path: LIST, respond: () => page([sampleProject, second]) },
    ]);
    const user = userEvent.setup();
    const { router } = renderRoute('/projects');
    await screen.findByRole('table');

    const nameHeader = screen.getByRole('columnheader', { name: /Project name/ });
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');

    await user.click(screen.getByRole('button', { name: /Charge code/ }));
    await waitFor(() =>
      expect(screen.getByRole('columnheader', { name: /Charge code/ })).toHaveAttribute(
        'aria-sort',
        'ascending',
      ),
    );
    expect(router.state.location.search).toBe('?sort=chargeCode');

    await user.click(screen.getByRole('button', { name: /Charge code/ }));
    await waitFor(() =>
      expect(screen.getByRole('columnheader', { name: /Charge code/ })).toHaveAttribute(
        'aria-sort',
        'descending',
      ),
    );
    expect(queryOf(requests.at(-1) as RecordedRequest)).toMatchObject({
      sort: 'chargeCode',
      order: 'desc',
    });
  });

  it('changes page and reflects it in the URL', async () => {
    const { requests } = mockFetch([
      {
        method: 'GET',
        path: LIST,
        respond: (req) =>
          page([queryOf(req).page === '2' ? second : sampleProject], {
            page: Number(queryOf(req).page ?? 1),
            totalItems: 30,
            totalPages: 2,
          }),
      },
    ]);
    const user = userEvent.setup();
    const { router } = renderRoute('/projects');
    await screen.findByRole('link', { name: 'Apollo Migration' });

    await user.click(screen.getByRole('button', { name: /next page/i }));
    expect(await screen.findByRole('link', { name: 'Gemini' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?page=2');
    expect(queryOf(requests.at(-1) as RecordedRequest)).toMatchObject({
      page: '2',
      pageSize: '25',
    });
  });

  it('reports a server error', async () => {
    mockFetch([{ method: 'GET', path: LIST, respond: () => problem(500, 'INTERNAL_ERROR') }]);
    renderRoute('/projects');
    expect(await screen.findByText('Projects could not be loaded')).toBeInTheDocument();
    expect(screen.getByText('Request ID: req-123')).toBeInTheDocument();
  });
});
