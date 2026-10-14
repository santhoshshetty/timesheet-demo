import { ProjectNotFoundError, VersionConflictError } from '../../domain/project/errors';
import type { Clock } from '../../domain/project/ports';
import type { Project, ProjectInput } from '../../domain/project/Project';
import type { UnitOfWork } from '../shared/UnitOfWork';

export interface UpdateProjectCommand {
  id: string;
  input: ProjectInput;
  expectedVersion: number;
}

export type UpdateProject = (command: UpdateProjectCommand) => Promise<Project>;

export function makeUpdateProject(deps: { unitOfWork: UnitOfWork; clock: Clock }): UpdateProject {
  const { unitOfWork, clock } = deps;
  return ({ id, input, expectedVersion }) =>
    unitOfWork.run(async ({ projects }) => {
      const current = await projects.findActiveById(id);
      if (!current) throw new ProjectNotFoundError();
      if (current.version !== expectedVersion) throw new VersionConflictError();

      const updated = await projects.update(current.update(input, clock.today()), expectedVersion);
      if (updated) return updated;

      // A concurrent edit or delete won the race.
      const latest = await projects.findActiveById(id);
      throw latest ? new VersionConflictError() : new ProjectNotFoundError();
    });
}
