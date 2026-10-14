import type { SortField, SortOrder } from '../../domain/project/ports';
import type { Project } from '../../domain/project/Project';
import type { UnitOfWork } from '../shared/UnitOfWork';

export interface ListProjectsQuery {
  search?: string;
  sort: SortField;
  order: SortOrder;
  page: number;
  pageSize: number;
}

export interface ProjectPage {
  items: Project[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export type ListProjects = (query: ListProjectsQuery) => Promise<ProjectPage>;

export function makeListProjects(deps: { unitOfWork: UnitOfWork }): ListProjects {
  return async ({ search, sort, order, page, pageSize }) => {
    const term = search?.trim() || undefined;
    const { items, totalItems } = await deps.unitOfWork.run(({ projects }) =>
      projects.search({ search: term, sort, order, page, pageSize }),
    );
    return { items, page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) };
  };
}
