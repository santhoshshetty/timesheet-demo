import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { mockFetch, problem, renderRoute, sampleProject, type Handler } from '../../support/render';

const path = `/api/v1/projects/${sampleProject.id}`;

const detail: Handler = {
  method: 'GET',
  path,
  respond: () => ({ status: 200, body: sampleProject, headers: { ETag: '"1"' } }),
};

const list: Handler = {
  method: 'GET',
  path: /^\/api\/v1\/projects(\?.*)?$/,
  respond: () => ({
    status: 200,
    body: { items: [], page: 1, pageSize: 25, totalItems: 0, totalPages: 0 },
  }),
};

async function openDialog() {
  const user = userEvent.setup();
  const result = renderRoute(`/projects/${sampleProject.id}`);
  await screen.findByRole('heading', { level: 1, name: 'Apollo Migration' });
  await user.click(screen.getByRole('button', { name: 'Delete' }));
  const dialog = await screen.findByRole('dialog', { name: 'Delete project?' });
  return { ...result, user, dialog };
}

describe('DeleteProjectDialog', () => {
  it('shows the project name and charge code, and has no axe violations', async () => {
    mockFetch([detail]);
    const { dialog } = await openDialog();
    expect(within(dialog).getByText('Apollo Migration')).toBeInTheDocument();
    expect(within(dialog).getByText('00412345')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /restore|purge/i })).toBeNull();
    expect(await axe(dialog)).toHaveNoViolations();
  });

  it('closes on Cancel without a request and returns focus to Delete', async () => {
    const { requests } = mockFetch([detail]);
    const { user, dialog } = await openDialog();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(requests.some((r) => r.method === 'DELETE')).toBe(false);
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveFocus();
  });

  it('deletes, navigates to the list, and announces it', async () => {
    const { requests } = mockFetch([
      detail,
      list,
      { method: 'DELETE', path, respond: () => ({ status: 204 }) },
    ]);
    const { user, dialog, router } = await openDialog();
    await user.click(within(dialog).getByRole('button', { name: 'Delete project' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/projects'));
    expect(requests.filter((r) => r.method === 'DELETE')).toHaveLength(1);
    expect(screen.getAllByText('Project deleted.').length).toBeGreaterThan(0);
  });

  it('shows "Project not found" for a 404', async () => {
    mockFetch([
      detail,
      { method: 'DELETE', path, respond: () => problem(404, 'PROJECT_NOT_FOUND') },
    ]);
    const { user, dialog } = await openDialog();
    await user.click(within(dialog).getByRole('button', { name: 'Delete project' }));
    expect(await within(dialog).findByText('Project not found')).toBeVisible();
  });
});
