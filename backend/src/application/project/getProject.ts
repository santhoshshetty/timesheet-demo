import { ProjectNotFoundError } from '../../domain/project/errors';
import type { Project } from '../../domain/project/Project';
import type { UnitOfWork } from '../shared/UnitOfWork';

export type GetProject = (id: string) => Promise<Project>;

export function makeGetProject(deps: { unitOfWork: UnitOfWork }): GetProject {
  return async (id) => {
    const project = await deps.unitOfWork.run(({ projects }) => projects.findActiveById(id));
    if (!project) throw new ProjectNotFoundError();
    return project;
  };
}
