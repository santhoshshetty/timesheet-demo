import { randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { todayUtc, uniqueName } from './support/data';

interface CreatedProject {
  id: string;
  name: string;
  chargeCode: string;
}

async function createViaApi(
  request: APIRequestContext,
  fields: { name: string; clientName?: string; endDate?: string },
): Promise<CreatedProject> {
  const response = await request.post('/api/v1/projects', {
    headers: { 'Idempotency-Key': randomUUID() },
    data: {
      name: fields.name,
      projectManager: { name: 'Priya Shah', email: 'priya.shah@example.com' },
      startDate: todayUtc(),
      endDate: fields.endDate ?? todayUtc(),
      projectType: fields.clientName ? 'CLIENT' : 'INTERNAL',
      clientName: fields.clientName ?? null,
      billingType: 'BILLABLE',
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as CreatedProject;
}

function detailValue(page: Page, term: string) {
  return page.locator('dt', { hasText: term }).locator('xpath=following-sibling::dd[1]');
}

async function search(page: Page, term: string) {
  const box = page.getByLabel('Search projects');
  await box.fill(term);
  await box.press('Enter');
  await expect.poll(() => new URL(page.url()).searchParams.get('search')).toBe(term);
}

async function expectNoSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  );
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
}

test.describe('Project lifecycle', () => {
  test('create and view a client project', async ({ page }) => {
    const name = uniqueName('E2E Apollo');
    const today = todayUtc();

    await page.goto('/projects/new');
    await expect(page.getByRole('heading', { level: 1, name: 'Create project' })).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    await page.getByLabel('Project name').fill(name);
    await page.getByLabel('Client Project').check();
    await page.getByLabel('Client name').fill('Contoso');
    await page.getByLabel('Project manager name').fill('Priya Shah');
    await page.getByLabel('Project manager email').fill('priya.shah@example.com');
    await page.getByLabel('Start date').fill(today);
    await page.getByLabel('End date').fill(today);
    await page.getByLabel('Billable', { exact: true }).check();
    await page.getByRole('button', { name: 'Create project' }).click();

    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}$/);
    const chargeCode = page
      .locator('dt', { hasText: 'Charge code' })
      .locator('xpath=following-sibling::dd[1]');
    await expect(chargeCode).toHaveText(/^[0-9]{8}$/);
    await expect(
      page.locator('dt', { hasText: 'Client name' }).locator('xpath=following-sibling::dd[1]'),
    ).toHaveText('Contoso');
    await expectNoSeriousA11yViolations(page);
  });

  test('find a project by client name and charge-code prefix', async ({ page, request }) => {
    const clientName = uniqueName('Northwind');
    const target = await createViaApi(request, { name: uniqueName('E2E Find'), clientName });
    const other = await createViaApi(request, {
      name: uniqueName('E2E Other'),
      clientName: uniqueName('Fabrikam'),
    });
    const results = page.getByRole('table').getByRole('link');

    await page.goto('/projects');
    await expect(page.getByRole('heading', { level: 1, name: 'Projects' })).toBeVisible();

    await search(page, clientName.slice(0, -2).toLowerCase());
    await expect(results).toHaveText([target.name]);
    await expectNoSeriousA11yViolations(page);

    await search(page, target.chargeCode.slice(0, 7));
    await expect(results).toHaveText([target.name]);
    await expect(page.getByRole('link', { name: other.name })).toHaveCount(0);

    await page.getByRole('link', { name: target.name }).click();
    await expect(page.getByRole('heading', { level: 1, name: target.name })).toBeVisible();
  });

  test('edit a project', async ({ page, request }) => {
    const project = await createViaApi(request, { name: uniqueName('E2E Edit') });
    const newName = uniqueName('E2E Edited');

    await page.goto(`/projects/${project.id}`);
    await page.getByRole('link', { name: 'Edit', exact: true }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: `Edit ${project.name}` }),
    ).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    await page.getByLabel('Project name').fill(newName);
    await page.getByLabel('End date').fill('2099-12-31');
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.getByRole('heading', { level: 1, name: newName })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/projects/${project.id}$`));
    await expect(detailValue(page, 'End date')).toHaveText('31 Dec 2099');
    await expect(detailValue(page, 'Charge code')).toHaveText(project.chargeCode);
  });

  test('delete a project', async ({ page, request }) => {
    const project = await createViaApi(request, { name: uniqueName('E2E Delete') });

    await page.goto(`/projects/${project.id}`);
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Delete project?' });
    await expect(dialog).toContainText(project.chargeCode);
    await dialog.getByRole('button', { name: 'Delete project' }).click();

    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByRole('link', { name: project.name })).toHaveCount(0);
    await search(page, project.name);
    await expect(page.getByRole('heading', { name: 'No matching projects' })).toBeVisible();

    await page.goto(`/projects/${project.id}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Project not found' })).toBeVisible();
  });
});
