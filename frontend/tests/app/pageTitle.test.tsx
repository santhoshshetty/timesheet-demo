import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockFetch, renderRoute, sampleProject } from '../support/render';

describe('page titles', () => {
  it('sets a unique title per route and updates it on client-side navigation', async () => {
    mockFetch([
      {
        method: 'GET',
        path: `/api/v1/projects/${sampleProject.id}`,
        respond: () => ({ status: 200, body: sampleProject, headers: { ETag: '"1"' } }),
      },
    ]);
    const user = userEvent.setup();
    const { router } = renderRoute('/projects');

    expect(await screen.findByRole('heading', { level: 1, name: 'Projects' })).toBeInTheDocument();
    expect(document.title).toBe('Projects – timesheet-demo');

    await user.click(screen.getByRole('link', { name: 'Create project' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Create project' }),
    ).toBeInTheDocument();
    expect(document.title).toBe('Create project – timesheet-demo');

    await act(() => router.navigate(`/projects/${sampleProject.id}`));
    expect(
      await screen.findByRole('heading', { level: 1, name: sampleProject.name }),
    ).toBeInTheDocument();
    expect(document.title).toBe('Apollo Migration – Project – timesheet-demo');

    await act(() => router.navigate('/nowhere'));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument();
    expect(document.title).toBe('Page not found – timesheet-demo');
  });

  it('redirects / to the project list', async () => {
    renderRoute('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Projects' })).toBeInTheDocument();
  });
});
