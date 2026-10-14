import type { ChargeCodeGenerator, Clock } from '../../domain/project/ports';
import {
  ChargeCodeCollisionError,
  ChargeCodeUnavailableError,
  DuplicateCreateRequestError,
  ProjectNotFoundError,
} from '../../domain/project/errors';
import { Project, type ProjectInput } from '../../domain/project/Project';
import type { UnitOfWork } from '../shared/UnitOfWork';

export interface CreateProjectCommand {
  input: ProjectInput;
  createRequestId: string;
}

export interface CreateProjectResult {
  project: Project;
  /** True when the same create request was already processed (FR-009). */
  replayed: boolean;
}

export type CreateProject = (command: CreateProjectCommand) => Promise<CreateProjectResult>;

export const MAX_CHARGE_CODE_ATTEMPTS = 5;

export function makeCreateProject(deps: {
  unitOfWork: UnitOfWork;
  chargeCodes: ChargeCodeGenerator;
  clock: Clock;
}): CreateProject {
  const { unitOfWork, chargeCodes, clock } = deps;

  const replay = async (createRequestId: string): Promise<CreateProjectResult | null> => {
    const existing = await unitOfWork.run(({ projects }) =>
      projects.findByCreateRequestId(createRequestId),
    );
    if (!existing) return null;
    if (existing.isDeleted) throw new ProjectNotFoundError();
    return { project: existing, replayed: true };
  };

  return async ({ input, createRequestId }) => {
    const previous = await replay(createRequestId);
    if (previous) return previous;

    const today = clock.today();
    for (let attempt = 1; attempt <= MAX_CHARGE_CODE_ATTEMPTS; attempt++) {
      const candidate = Project.create(input, today, chargeCodes.next(), createRequestId);
      try {
        // Each attempt gets its own transaction: a failed INSERT aborts the PostgreSQL transaction.
        const project = await unitOfWork.run(({ projects }) => projects.insert(candidate));
        return { project, replayed: false };
      } catch (error) {
        if (error instanceof ChargeCodeCollisionError) continue;
        if (error instanceof DuplicateCreateRequestError) {
          const concurrent = await replay(createRequestId);
          if (concurrent) return concurrent;
        }
        throw error;
      }
    }
    throw new ChargeCodeUnavailableError();
  };
}
