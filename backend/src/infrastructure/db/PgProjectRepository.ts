import type { QueryResultRow } from 'pg';
import { CalendarDate } from '../../domain/project/CalendarDate';
import { ChargeCode } from '../../domain/project/ChargeCode';
import {
  ChargeCodeCollisionError,
  DuplicateCreateRequestError,
  ProjectNameTakenError,
} from '../../domain/project/errors';
import type {
  ProjectRepository,
  SearchCriteria,
  SearchResult,
  SortField,
} from '../../domain/project/ports';
import {
  Project,
  type BillingType,
  type NewProject,
  type ProjectType,
} from '../../domain/project/Project';
import { escapeLike } from './escapeLike';
import { mapUniqueViolation } from './pgErrors';

/** Anything that can run a parameterized query: a pool or a transaction client. */
export interface Queryable {
  query<R extends QueryResultRow>(text: string, values?: unknown[]): Promise<{ rows: R[] }>;
}

interface ProjectRow {
  id: string;
  charge_code: string;
  name: string;
  project_manager_name: string;
  project_manager_email: string;
  start_date: string;
  end_date: string;
  project_type: ProjectType;
  client_name: string | null;
  billing_type: BillingType;
  create_request_id: string;
  version: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

const ACTIVE = 'deleted_at IS NULL';

const SORT_COLUMNS: Record<SortField, string> = {
  name: 'lower(name)',
  chargeCode: 'charge_code',
  startDate: 'start_date',
  endDate: 'end_date',
};

export class PgProjectRepository implements ProjectRepository {
  constructor(private readonly db: Queryable) {}

  async insert(project: NewProject): Promise<Project> {
    try {
      const { rows } = await this.db.query<ProjectRow>(
        `INSERT INTO project (
           charge_code, name, project_manager_name, project_manager_email, start_date, end_date,
           project_type, client_name, billing_type, create_request_id, version
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          project.chargeCode.toString(),
          project.name,
          project.projectManager.name,
          project.projectManager.email,
          project.startDate.toString(),
          project.endDate.toString(),
          project.projectType,
          project.clientName,
          project.billingType,
          project.createRequestId,
          project.version,
        ],
      );
      return toProject(firstRow(rows));
    } catch (error) {
      switch (mapUniqueViolation(error)) {
        case 'CHARGE_CODE_COLLISION':
          throw new ChargeCodeCollisionError();
        case 'NAME_TAKEN':
          throw new ProjectNameTakenError();
        case 'DUPLICATE_CREATE_REQUEST':
          throw new DuplicateCreateRequestError();
        default:
          throw error;
      }
    }
  }

  async findActiveById(id: string): Promise<Project | null> {
    const { rows } = await this.db.query<ProjectRow>(
      `SELECT * FROM project WHERE id = $1 AND ${ACTIVE}`,
      [id],
    );
    return rows[0] ? toProject(rows[0]) : null;
  }

  async findByCreateRequestId(createRequestId: string): Promise<Project | null> {
    const { rows } = await this.db.query<ProjectRow>(
      'SELECT * FROM project WHERE create_request_id = $1',
      [createRequestId],
    );
    return rows[0] ? toProject(rows[0]) : null;
  }

  async search(criteria: SearchCriteria): Promise<SearchResult> {
    const values: unknown[] = [];
    let where = ACTIVE;
    if (criteria.search) {
      values.push(`%${escapeLike(criteria.search)}%`);
      where += ` AND (name ILIKE $1 ESCAPE '\\' OR charge_code ILIKE $1 ESCAPE '\\'
        OR project_manager_name ILIKE $1 ESCAPE '\\' OR project_manager_email ILIKE $1 ESCAPE '\\'
        OR client_name ILIKE $1 ESCAPE '\\')`;
    }
    // Sort column and direction come from fixed whitelists, never from raw input.
    const column = SORT_COLUMNS[criteria.sort];
    const direction = criteria.order === 'desc' ? 'DESC' : 'ASC';
    values.push(criteria.pageSize, (criteria.page - 1) * criteria.pageSize);
    const limit = `$${values.length - 1}`;
    const offset = `$${values.length}`;

    const { rows } = await this.db.query<ProjectRow & { total_items: string }>(
      `SELECT *, COUNT(*) OVER() AS total_items FROM project
       WHERE ${where}
       ORDER BY ${column} ${direction}, id ${direction}
       LIMIT ${limit} OFFSET ${offset}`,
      values,
    );
    if (rows[0]) {
      return { items: rows.map(toProject), totalItems: Number(rows[0].total_items) };
    }
    // A page past the end returns no rows, so count separately.
    const count = await this.db.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM project WHERE ${where}`,
      values.slice(0, values.length - 2),
    );
    return { items: [], totalItems: Number(count.rows[0]?.total ?? 0) };
  }

  async update(project: Project, expectedVersion: number): Promise<Project | null> {
    try {
      // charge_code is deliberately absent from SET: it can never change (FR-014).
      const { rows } = await this.db.query<ProjectRow>(
        `UPDATE project SET
           name = $3, project_manager_name = $4, project_manager_email = $5,
           start_date = $6, end_date = $7, project_type = $8, client_name = $9,
           billing_type = $10, version = version + 1, updated_at = now()
         WHERE id = $1 AND version = $2 AND ${ACTIVE}
         RETURNING *`,
        [
          project.id,
          expectedVersion,
          project.name,
          project.projectManager.name,
          project.projectManager.email,
          project.startDate.toString(),
          project.endDate.toString(),
          project.projectType,
          project.clientName,
          project.billingType,
        ],
      );
      return rows[0] ? toProject(rows[0]) : null;
    } catch (error) {
      if (mapUniqueViolation(error) === 'NAME_TAKEN') throw new ProjectNameTakenError();
      throw error;
    }
  }

  async softDelete(id: string): Promise<boolean> {
    const { rows } = await this.db.query<{ id: string }>(
      `UPDATE project SET deleted_at = now(), updated_at = now(), version = version + 1
       WHERE id = $1 AND ${ACTIVE}
       RETURNING id`,
      [id],
    );
    return rows.length > 0;
  }
}

function firstRow(rows: ProjectRow[]): ProjectRow {
  const row = rows[0];
  if (!row) throw new Error('Expected a row to be returned');
  return row;
}

function toProject(row: ProjectRow): Project {
  return Project.fromPersistence({
    id: row.id,
    chargeCode: ChargeCode.of(row.charge_code),
    name: row.name,
    projectManager: { name: row.project_manager_name, email: row.project_manager_email },
    startDate: CalendarDate.of(row.start_date),
    endDate: CalendarDate.of(row.end_date),
    projectType: row.project_type,
    clientName: row.client_name,
    billingType: row.billing_type,
    createRequestId: row.create_request_id,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  });
}
