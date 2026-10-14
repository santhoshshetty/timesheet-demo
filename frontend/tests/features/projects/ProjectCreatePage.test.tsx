import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { axe } from 'jest-axe';
import {
  mockFetch,
  networkFailure,
  problem,
  renderRoute,
  sampleProject,
  type Handler,
} from '../../support/render';

const detailHandler: Handler = {
  method: 'GET',
  path: `/api/v1/projects/${sampleProject.id}`,
  respond: () => ({ status: 200, body: sampleProject, headers: { ETag: '"1"' } }),
};

function created(status = 201): Handler {
  return {
    method: 'POST',
    path: '/api/v1/projects',
    respond: () => ({ status, body: sampleProject, headers: { ETag: '"1"' } }),
  };
}

function setDate(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(new RegExp(`^${label}`)), { target: { value } });
}

async function fillValidForm(user: UserEvent, overrides: { startDate?: string } = {}) {
  await user.type(screen.getByLabelText(/^Project name/), 'Apollo Migration');
  await user.click(screen.getByLabelText('Client Project'));
  await user.type(screen.getByLabelText(/^Client name/), 'Contoso');
  await user.type(screen.getByLabelText(/^Project manager name/), 'Priya Shah');
  await user.type(screen.getByLabelText(/^Project manager email/), 'priya.shah@example.com');
  setDate('Start date', overrides.startDate ?? '2099-01-05');
  setDate('End date', '2099-03-31');
  await user.click(screen.getByLabelText('Billable'));
}

async function openCreatePage() {
  const result = renderRoute('/projects/new');
  await screen.findByRole('heading', { level: 1, name: 'Create project' });
  return result;
}

const submitButton = () => screen.getByRole('button', { name: /Create project|Saving/ });

describe('ProjectCreatePage', () => {
  it('groups fields into sections, has no charge code input, and sets the title', async () => {
    mockFetch([]);
    await openCreatePage();
    for (const name of ['General', 'Project manager', 'Schedule', 'Billing']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
    expect(screen.queryByLabelText(/charge code/i)).not.toBeInTheDocument();
    expect(document.title).toBe('Create project – timesheet-demo');
  });

  it('shows Client name only for Client Projects', async () => {
    mockFetch([]);
    const user = userEvent.setup();
    await openCreatePage();
    expect(screen.queryByLabelText(/^Client name/)).not.toBeInTheDocument();
    await user.click(screen.getByLabelText('Client Project'));
    expect(screen.getByLabelText(/^Client name/)).toBeInTheDocument();
    await user.click(screen.getByLabelText('Internal Project'));
    expect(screen.queryByLabelText(/^Client name/)).not.toBeInTheDocument();
  });

  it('shows a focused error summary and per-field messages when submitted empty', async () => {
    const { fetchMock } = mockFetch([]);
    const user = userEvent.setup();
    await openCreatePage();
    await user.click(submitButton());

    const summary = await screen.findByRole('alert');
    expect(within(summary).getByText('There is a problem')).toBeInTheDocument();
    await waitFor(() => expect(summary).toHaveFocus());
    for (const message of [
      'Project name is required.',
      'Project type is required.',
      'Project manager name is required.',
      'Project manager email is required.',
      'Start date is required.',
      'End date is required.',
      'Billing type is required.',
    ]) {
      expect(within(summary).getByRole('link', { name: message })).toBeInTheDocument();
    }
    expect(screen.getByLabelText(/^Project name/)).toHaveAccessibleDescription(
      'Project name is required.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps server 422 and 409 errors onto fields and keeps entered values', async () => {
    let call = 0;
    mockFetch([
      {
        method: 'POST',
        path: '/api/v1/projects',
        respond: () => {
          call += 1;
          return call === 1
            ? problem(422, 'BUSINESS_RULE_VIOLATION', [
                {
                  field: 'startDate',
                  code: 'START_DATE_IN_PAST',
                  message: 'Start date cannot be in the past.',
                },
              ])
            : problem(409, 'PROJECT_NAME_TAKEN', [
                {
                  field: 'name',
                  code: 'INVALID_VALUE',
                  message: 'A project with this name already exists.',
                },
              ]);
        },
      },
    ]);
    const user = userEvent.setup();
    await openCreatePage();
    await fillValidForm(user);

    await user.click(submitButton());
    expect(await screen.findByLabelText(/^Start date/)).toHaveAccessibleDescription(
      'Start date cannot be in the past.',
    );

    await user.click(submitButton());
    expect(await screen.findByLabelText(/^Project name/)).toHaveAccessibleDescription(
      'A project with this name already exists.',
    );
    expect(screen.getByLabelText(/^Project name/)).toHaveValue('Apollo Migration');
    expect(screen.getByLabelText(/^Client name/)).toHaveValue('Contoso');
  });

  it('disables the submit button while the request is in flight', async () => {
    let release: () => void = () => undefined;
    mockFetch([
      {
        method: 'POST',
        path: '/api/v1/projects',
        respond: () =>
          new Promise((resolve) => {
            release = () => resolve({ status: 201, body: sampleProject });
          }),
      },
      detailHandler,
    ]);
    const user = userEvent.setup();
    await openCreatePage();
    await fillValidForm(user);
    await user.click(submitButton());

    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    release();
    await screen.findByRole('heading', { level: 1, name: sampleProject.name });
  });

  it('sends the same Idempotency-Key when retrying after a network error', async () => {
    let call = 0;
    const { requests } = mockFetch([
      {
        method: 'POST',
        path: '/api/v1/projects',
        respond: () => {
          call += 1;
          if (call === 1) networkFailure();
          return { status: 201, body: sampleProject };
        },
      },
      detailHandler,
    ]);
    const user = userEvent.setup();
    await openCreatePage();
    await fillValidForm(user);
    await user.click(submitButton());

    expect(await screen.findByText('The project was not saved')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Project name/)).toHaveValue('Apollo Migration');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByRole('heading', { level: 1, name: sampleProject.name });

    const keys = requests
      .filter((r) => r.method === 'POST')
      .map((r) => r.headers['Idempotency-Key']);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(keys[1]).toBe(keys[0]);
  });

  it('shows a non-blocking hint for a past start date and still submits', async () => {
    const { requests } = mockFetch([
      {
        method: 'POST',
        path: '/api/v1/projects',
        respond: () =>
          problem(422, 'BUSINESS_RULE_VIOLATION', [
            {
              field: 'startDate',
              code: 'START_DATE_IN_PAST',
              message: 'Start date cannot be in the past.',
            },
          ]),
      },
    ]);
    const user = userEvent.setup();
    await openCreatePage();
    await fillValidForm(user, { startDate: '2000-01-03' });
    setDate('End date', '2000-01-31');

    expect(screen.getByLabelText(/^Start date/)).toHaveAccessibleDescription(
      /start date is before today/i,
    );
    expect(screen.getByLabelText(/^Start date/)).not.toHaveAttribute('aria-invalid', 'true');

    await user.click(submitButton());
    expect(await screen.findByLabelText(/^Start date/)).toHaveAccessibleDescription(
      'Start date cannot be in the past.',
    );
    expect(requests.filter((r) => r.method === 'POST')).toHaveLength(1);
  });

  it('navigates to the new project and announces the charge code on success', async () => {
    const { requests } = mockFetch([created(201), detailHandler]);
    const user = userEvent.setup();
    const { router } = await openCreatePage();
    await fillValidForm(user);
    await user.click(submitButton());

    await screen.findByRole('heading', { level: 1, name: sampleProject.name });
    expect(router.state.location.pathname).toBe(`/projects/${sampleProject.id}`);
    expect(screen.getByRole('status')).toHaveTextContent('Project created. Charge code 00412345.');
    expect(requests[0]?.body).toEqual({
      name: 'Apollo Migration',
      projectManager: { name: 'Priya Shah', email: 'priya.shah@example.com' },
      startDate: '2099-01-05',
      endDate: '2099-03-31',
      projectType: 'CLIENT',
      clientName: 'Contoso',
      billingType: 'BILLABLE',
    });
  });

  it('opens the saved project with a notice when the server replays the request (200)', async () => {
    mockFetch([created(200), detailHandler]);
    const user = userEvent.setup();
    await openCreatePage();
    await fillValidForm(user);
    await user.click(submitButton());

    await screen.findByRole('heading', { level: 1, name: sampleProject.name });
    expect(screen.getByRole('status')).toHaveTextContent(
      'This project was already created. Showing the saved project.',
    );
  });

  it('has no detectable accessibility violations, including with errors shown', async () => {
    mockFetch([]);
    const user = userEvent.setup();
    const { container } = await openCreatePage();
    expect(await axe(container)).toHaveNoViolations();
    await user.click(submitButton());
    await screen.findByRole('alert');
    expect(await axe(container)).toHaveNoViolations();
  });
});
