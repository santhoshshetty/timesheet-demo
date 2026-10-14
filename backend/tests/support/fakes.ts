import { randomUUID } from 'node:crypto';
import type { Repositories, UnitOfWork } from '../../src/application/shared/UnitOfWork';
import { CalendarDate } from '../../src/domain/project/CalendarDate';
import { ChargeCode } from '../../src/domain/project/ChargeCode';
import {
  ChargeCodeCollisionError,
  DuplicateCreateRequestError,
  ProjectNameTakenError,
} from '../../src/domain/project/errors';
import type {
  ChargeCodeGenerator,
  Clock,
  ProjectRepository,
  SearchCriteria,
  SearchResult,
} from '../../src/domain/project/ports';
import { Project, type NewProject, type ProjectSnapshot } from '../../src/domain/project/Project';

export const TODAY = '2026-10-06';

export class FixedClock implements Clock {
  constructor(
    public todayValue: string = TODAY,
    public instant: Date = new Date(`${TODAY}T12:00:00Z`),
  ) {}

  today(): CalendarDate {
    return CalendarDate.of(this.todayValue);
  }

  now(): Date {
    return this.instant;
  }
}

/** Returns the configured codes in order, then keeps repeating the last one. */
export class SequenceChargeCodeGenerator implements ChargeCodeGenerator {
  private index = 0;

  constructor(private readonly codes: readonly string[]) {}

  next(): ChargeCode {
    const code = this.codes[Math.min(this.index, this.codes.length - 1)];
    this.index += 1;
    if (code === undefined) throw new Error('SequenceChargeCodeGenerator has no codes');
    return ChargeCode.of(code);
  }

  get calls(): number {
    return this.index;
  }
}

/** Enforces the same uniqueness rules as the database for use-case unit tests. */
export class InMemoryProjectRepository implements ProjectRepository {
  readonly rows: ProjectSnapshot[] = [];
  lastSearch: SearchCriteria | undefined;
  /** Lets tests simulate a concurrent change between the read and the write. */
  beforeUpdate: (() => void) | undefined;

  insert(project: NewProject): Promise<Project> {
    if (this.rows.some((row) => row.chargeCode.equals(project.chargeCode))) {
      return Promise.reject(new ChargeCodeCollisionError());
    }
    if (this.rows.some((row) => row.createRequestId === project.createRequestId)) {
      return Promise.reject(new DuplicateCreateRequestError());
    }
    const lowerName = project.name.toLowerCase();
    if (this.rows.some((row) => !row.deletedAt && row.name.toLowerCase() === lowerName)) {
      return Promise.reject(new ProjectNameTakenError());
    }
    const now = new Date();
    const snapshot: ProjectSnapshot = {
      ...project,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    this.rows.push(snapshot);
    return Promise.resolve(Project.fromPersistence(snapshot));
  }

  findActiveById(id: string): Promise<Project | null> {
    const row = this.rows.find((r) => r.id === id && !r.deletedAt);
    return Promise.resolve(row ? Project.fromPersistence(row) : null);
  }

  findByCreateRequestId(createRequestId: string): Promise<Project | null> {
    const row = this.rows.find((r) => r.createRequestId === createRequestId);
    return Promise.resolve(row ? Project.fromPersistence(row) : null);
  }

  /** Simplified search: substring match on name only, sorted by name, for use-case tests. */
  search(criteria: SearchCriteria): Promise<SearchResult> {
    this.lastSearch = criteria;
    const term = criteria.search?.toLowerCase();
    const matches = this.rows
      .filter((r) => !r.deletedAt && (!term || r.name.toLowerCase().includes(term)))
      .sort((a, b) => a.name.localeCompare(b.name));
    const start = (criteria.page - 1) * criteria.pageSize;
    return Promise.resolve({
      items: matches.slice(start, start + criteria.pageSize).map((r) => Project.fromPersistence(r)),
      totalItems: matches.length,
    });
  }

  update(project: Project, expectedVersion: number): Promise<Project | null> {
    this.beforeUpdate?.();
    const index = this.rows.findIndex(
      (r) => r.id === project.id && !r.deletedAt && r.version === expectedVersion,
    );
    const current = this.rows[index];
    if (!current) return Promise.resolve(null);
    const lowerName = project.name.toLowerCase();
    if (
      this.rows.some(
        (r) => r.id !== project.id && !r.deletedAt && r.name.toLowerCase() === lowerName,
      )
    ) {
      return Promise.reject(new ProjectNameTakenError());
    }
    const next: ProjectSnapshot = {
      ...project.toSnapshot(),
      chargeCode: current.chargeCode,
      version: current.version + 1,
      updatedAt: new Date(),
    };
    this.rows[index] = next;
    return Promise.resolve(Project.fromPersistence(next));
  }

  softDelete(id: string): Promise<boolean> {
    const row = this.rows.find((r) => r.id === id && !r.deletedAt);
    if (!row) return Promise.resolve(false);
    row.deletedAt = new Date();
    row.version += 1;
    return Promise.resolve(true);
  }

  markDeleted(id: string): void {
    const row = this.rows.find((r) => r.id === id);
    if (row) row.deletedAt = new Date();
  }

  bumpVersion(id: string): void {
    const row = this.rows.find((r) => r.id === id);
    if (row) row.version += 1;
  }
}

export class InMemoryUnitOfWork implements UnitOfWork {
  constructor(readonly projects: InMemoryProjectRepository = new InMemoryProjectRepository()) {}

  run<T>(work: (repositories: Repositories) => Promise<T>): Promise<T> {
    return work({ projects: this.projects });
  }
}
