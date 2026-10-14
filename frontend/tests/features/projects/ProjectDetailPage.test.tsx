import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import {
  mockFetch,
  networkFailure,
  problem,
  renderRoute,
  sampleProject,
} from '../../support/render';

const path = `/api/v1/projects/${sampleProject.id}`;

describe('ProjectDetailPage', () => {
  it('shows every project field, including the 8-digit charge code', async () => {
    mockFetch([
      {
        method: 'GET',
        path,
        respond: () => ({ status: 200, body: sampleProject, headers: { ETag: '"1"' } }),
      },
    ]);
    const { container } = renderRoute(`/projects/${sampleProject.id}`);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Apollo Migration' }),
    ).toBeInTheDocument();
    const value = (term: string) => screen.getByText(term).nextElementSibling?.textContent;
    expect(value('Charge code')).toBe('00412345');
    expect(value('Project type')).toBe('Client Project');
    expect(value('Client name')).toBe('Contoso');
    expect(value('Billing type')).toBe('Billable');
    expect(value('Name')).toBe('Priya Shah');
    expect(value('Email')).toBe('priya.shah@example.com');
    expect(value('Start date')).toBe('05 Jan 2099');
    expect(value('End date')).toBe('31 Mar 2099');
    expect(document.title).toBe('Apollo Migration – Project – timesheet-demo');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('omits Client name for internal projects', async () => {
    mockFetch([
      {
        method: 'GET',
        path,
        respond: () => ({
          status: 200,
          body: { ...sampleProject, projectType: 'INTERNAL', clientName: null },
        }),
      },
    ]);
    renderRoute(`/projects/${sampleProject.id}`);
    await screen.findByRole('heading', { level: 1, name: 'Apollo Migration' });
    expect(screen.queryByText('Client name')).not.toBeInTheDocument();
    expect(screen.getByText('Internal Project')).toBeInTheDocument();
  });

  it('shows a loading state while fetching', async () => {
    mockFetch([{ method: 'GET', path, respond: () => new Promise(() => undefined) }]);
    renderRoute(`/projects/${sampleProject.id}`);
    const loading = await screen.findByText('Loading project…');
    expect(loading.closest('[role="status"]')).not.toBeNull();
    expect(document.title).toBe('Loading project – timesheet-demo');
  });

  it('shows "Project not found" with a link back to the list for 404', async () => {
    mockFetch([{ method: 'GET', path, respond: () => problem(404, 'PROJECT_NOT_FOUND') }]);
    const { container } = renderRoute(`/projects/${sampleProject.id}`);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Project not found' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to projects' })).toHaveAttribute(
      'href',
      '/projects',
    );
    expect(document.title).toBe('Project not found – timesheet-demo');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows an error state and retries on network failure', async () => {
    let call = 0;
    mockFetch([
      {
        method: 'GET',
        path,
        respond: () => {
          call += 1;
          if (call === 1) networkFailure();
          return { status: 200, body: sampleProject };
        },
      },
    ]);
    const user = userEvent.setup();
    renderRoute(`/projects/${sampleProject.id}`);

    expect(await screen.findByText('The service could not be reached')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Apollo Migration' }),
    ).toBeInTheDocument();
  });
});
