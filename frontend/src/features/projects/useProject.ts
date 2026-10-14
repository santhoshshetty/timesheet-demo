import { useCallback, useEffect, useState } from 'react';
import type { Project } from '@timesheet/api-contract';
import { ApiError, type ApiProblem } from '../../api/client';
import { getProject } from './api';

export type ProjectState =
  | { status: 'loading' }
  | { status: 'loaded'; project: Project; etag: string | null }
  | { status: 'not-found' }
  | { status: 'error'; problem: ApiProblem };

const UNEXPECTED: ApiProblem = {
  status: 0,
  code: 'UNEXPECTED',
  title: 'Something went wrong',
  detail: 'Please try again.',
  errors: [],
};

async function load(id: string | undefined): Promise<ProjectState> {
  if (!id) return { status: 'not-found' };
  try {
    const { project, etag } = await getProject(id);
    return { status: 'loaded', project, etag };
  } catch (error) {
    if (error instanceof ApiError) {
      // A malformed id (400) is just another project that doesn't exist for the user.
      if (error.problem.status === 404 || error.problem.status === 400) {
        return { status: 'not-found' };
      }
      return { status: 'error', problem: error.problem };
    }
    return { status: 'error', problem: UNEXPECTED };
  }
}

export function useProject(id: string | undefined): { state: ProjectState; reload: () => void } {
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${id ?? ''}#${attempt}`;
  const [result, setResult] = useState<{ key: string; state: ProjectState } | null>(null);

  useEffect(() => {
    let active = true;
    void load(id).then((state) => {
      if (active) setResult({ key: requestKey, state });
    });
    return () => {
      active = false;
    };
  }, [id, requestKey]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const state: ProjectState = result?.key === requestKey ? result.state : { status: 'loading' };
  return { state, reload };
}
