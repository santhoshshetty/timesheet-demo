import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { mockFetch, problem, renderRoute, sampleProject, type Handler } from '../../support/render';

const path = `/api/v1/projects/${sampleProject.id}`;
const editUrl = `/projects/${sampleProject.id}/edit`;

function loaded(project: object = sampleProject, etag = '"1"'): Handler {
  return {
    method: 'GET',
    path,
    respond: () => ({ status: 200, body: project, headers: { ETag: etag } }),
  };
}

async function openEditPage() {
  const result = renderRoute(editUrl);
  await screen.findByRole('heading', { level: 1, name: 'Edit Apollo Migration' });
  return result;
}

const nameField = () => screen.getByLabelText(/^Project name/);

describe('ProjectEditPage', () => {
  it('prefills the form, shows the charge code read-only, and has no axe violations', async () => {
    mockFetch([loaded()]);
    const { container } = await openEditPage();

    expect(nameField()).toHaveValue('Apollo Migration');
    expect(screen.getByLabelText(/^Client name/)).toHaveValue('Contoso');
    expect(screen.getByLabelText(/^Project manager email/)).toHaveValue('priya.shah@example.com');
    expect(screen.getByLabelText(/^Start date/)).toHaveValue('2099-01-05');
    expect(screen.getByLabelText('Client Project')).toBeChecked();
    expect(screen.getByLabelText('Billable')).toBeChecked();
    expect(screen.getByText('00412345')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /charge code/i })).not.toBeInTheDocument();
    expect(document.title).toBe('Edit Apollo Migration – timesheet-demo');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('sends If-Match with the loaded ETag, omits the charge code, and announces success', async () => {
    const { requests } = mockFetch([
      loaded(sampleProject, '"7"'),
      {
        method: 'PUT',
        path,
        respond: () => ({
          status: 200,
          body: { ...sampleProject, name: 'Apollo Phase 2', version: 8 },
          headers: { ETag: '"8"' },
        }),
      },
    ]);
    const user = userEvent.setup();
    const { router } = await openEditPage();

    await user.clear(nameField());
    await user.type(nameField(), 'Apollo Phase 2');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/projects/${sampleProject.id}`),
    );
    const put = requests.find((r) => r.method === 'PUT');
    expect(put?.headers['If-Match']).toBe('"7"');
    expect(put?.body).toMatchObject({ name: 'Apollo Phase 2' });
    expect(put?.body).not.toHaveProperty('chargeCode');
    expect(screen.getAllByText('Project updated.').length).toBeGreaterThan(0);
  });

  it('offers a Reload after a 412 conflict and refetches the project', async () => {
    let gets = 0;
    mockFetch([
      {
        method: 'GET',
        path,
        respond: () => {
          gets += 1;
          const project =
            gets === 1 ? sampleProject : { ...sampleProject, name: 'Renamed', version: 2 };
          return { status: 200, body: project, headers: { ETag: `"${gets}"` } };
        },
      },
      { method: 'PUT', path, respond: () => problem(412, 'VERSION_CONFLICT') },
    ]);
    const user = userEvent.setup();
    await openEditPage();

    await user.type(nameField(), ' X');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('This project was changed by someone else')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Reload' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Edit Renamed' })).toBeVisible();
    expect(nameField()).toHaveValue('Renamed');
    expect(gets).toBe(2);
  });

  it('shows "Project not found" when the project does not exist', async () => {
    mockFetch([{ method: 'GET', path, respond: () => problem(404, 'PROJECT_NOT_FOUND') }]);
    renderRoute(editUrl);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Project not found' }),
    ).toBeInTheDocument();
  });

  it('shows server field errors on the matching fields', async () => {
    mockFetch([
      loaded(),
      {
        method: 'PUT',
        path,
        respond: () =>
          problem(422, 'BUSINESS_RULE_VIOLATION', [
            {
              field: 'endDate',
              code: 'END_DATE_SHORTENED',
              message: 'End date cannot be moved earlier than its current value.',
            },
          ]),
      },
    ]);
    const user = userEvent.setup();
    await openEditPage();
    fireEvent.change(screen.getByLabelText(/^End date/), { target: { value: '2099-02-01' } });
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByLabelText(/^End date/)).toHaveValue('2099-02-01');
    expect(
      await screen.findAllByText('End date cannot be moved earlier than its current value.'),
    ).not.toHaveLength(0);
  });

  it('asks for confirmation before leaving with unsaved changes', async () => {
    mockFetch([loaded()]);
    const user = userEvent.setup();
    const { router } = await openEditPage();

    await user.type(nameField(), ' X');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByRole('dialog', { name: 'Discard unsaved changes?' })).toBeVisible();
    expect(router.state.location.pathname).toBe(editUrl);

    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(nameField()).toHaveValue('Apollo Migration X');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(await screen.findByRole('button', { name: 'Discard changes' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/projects/${sampleProject.id}`),
    );
  });

  it('leaves without confirmation when nothing changed', async () => {
    mockFetch([loaded()]);
    const user = userEvent.setup();
    const { router } = await openEditPage();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/projects/${sampleProject.id}`),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
