import type { ProjectRepository } from '../../domain/project/ports';

export interface Repositories {
  projects: ProjectRepository;
}

/** Runs work inside one transaction; commits on success and rolls back on any error. */
export interface UnitOfWork {
  run<T>(work: (repositories: Repositories) => Promise<T>): Promise<T>;
}
