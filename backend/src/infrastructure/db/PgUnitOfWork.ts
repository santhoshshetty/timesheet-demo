import type { Pool } from 'pg';
import type { Repositories, UnitOfWork } from '../../application/shared/UnitOfWork';
import { PgProjectRepository } from './PgProjectRepository';

export class PgUnitOfWork implements UnitOfWork {
  constructor(private readonly pool: Pool) {}

  async run<T>(work: (repositories: Repositories) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work({ projects: new PgProjectRepository(client) });
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
