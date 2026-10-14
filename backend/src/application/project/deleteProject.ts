import { ProjectNotFoundError } from '../../domain/project/errors';
import type { Clock } from '../../domain/project/ports';
import type { UnitOfWork } from '../shared/UnitOfWork';

export type DeleteProject = (id: string) => Promise<void>;

export function makeDeleteProject(deps: { unitOfWork: UnitOfWork; clock: Clock }): DeleteProject {
  const { unitOfWork, clock } = deps;
  return (id) =>
    unitOfWork.run(async ({ projects }) => {
      const project = await projects.findActiveById(id);
      if (!project) throw new ProjectNotFoundError();
      project.delete(clock.now());
      if (!(await projects.softDelete(id))) throw new ProjectNotFoundError();
    });
}
