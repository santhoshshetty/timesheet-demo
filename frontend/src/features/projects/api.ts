import type { Project, ProjectInput, ProjectPage } from '@timesheet/api-contract';
import { request } from '../../api/client';

const BASE = '/api/v1/projects';

export type SortField = 'name' | 'chargeCode' | 'startDate' | 'endDate';
export type SortOrder = 'asc' | 'desc';

export interface ListParams {
  search?: string;
  sort?: SortField;
  order?: SortOrder;
  page?: number;
  pageSize?: number;
}

export async function listProjects(params: ListParams = {}): Promise<ProjectPage> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  const queryString = query.toString();
  const suffix = queryString ? `?${queryString}` : '';
  return (await request<ProjectPage>('GET', `${BASE}${suffix}`)).data;
}

export async function updateProject(
  id: string,
  input: ProjectInput,
  etag: string,
): Promise<{ project: Project; etag: string | null }> {
  const response = await request<Project>('PUT', `${BASE}/${encodeURIComponent(id)}`, {
    body: input,
    headers: { 'If-Match': etag },
  });
  return { project: response.data, etag: response.headers.get('ETag') };
}

export async function deleteProject(id: string): Promise<void> {
  await request<void>('DELETE', `${BASE}/${encodeURIComponent(id)}`);
}

export async function createProject(
  input: ProjectInput,
  idempotencyKey: string,
): Promise<{ project: Project; replayed: boolean }> {
  const response = await request<Project>('POST', BASE, {
    body: input,
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  return { project: response.data, replayed: response.status === 200 };
}

export async function getProject(id: string): Promise<{ project: Project; etag: string | null }> {
  const response = await request<Project>('GET', `${BASE}/${encodeURIComponent(id)}`);
  return { project: response.data, etag: response.headers.get('ETag') };
}
