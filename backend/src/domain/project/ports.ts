import type { CalendarDate } from './CalendarDate';
import type { ChargeCode } from './ChargeCode';
import type { NewProject, Project } from './Project';

export type SortField = 'name' | 'chargeCode' | 'startDate' | 'endDate';
export type SortOrder = 'asc' | 'desc';

export interface SearchCriteria {
  search?: string;
  sort: SortField;
  order: SortOrder;
  page: number;
  pageSize: number;
}

export interface SearchResult {
  items: Project[];
  totalItems: number;
}

export interface ProjectRepository {
  /** Throws ChargeCodeCollisionError, ProjectNameTakenError, or DuplicateCreateRequestError. */
  insert(project: NewProject): Promise<Project>;
  findActiveById(id: string): Promise<Project | null>;
  /** Includes deleted projects so replays of a deleted project's request can be detected. */
  findByCreateRequestId(createRequestId: string): Promise<Project | null>;
  search(criteria: SearchCriteria): Promise<SearchResult>;
  /** Returns null when no active project with the expected version was updated. */
  update(project: Project, expectedVersion: number): Promise<Project | null>;
  /** Returns false when no active project was deleted. */
  softDelete(id: string): Promise<boolean>;
}

export interface ChargeCodeGenerator {
  next(): ChargeCode;
}

export interface Clock {
  today(): CalendarDate;
  now(): Date;
}
