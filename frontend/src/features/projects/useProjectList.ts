import { useCallback, useEffect, useState } from 'react';
import type { ProjectPage } from '@timesheet/api-contract';
import { useSearchParams } from 'react-router';
import { ApiError, type ApiProblem } from '../../api/client';
import { listProjects, type SortField, type SortOrder } from './api';

export const PAGE_SIZE = 25;
export const SEARCH_DEBOUNCE_MS = 300;

const SORT_FIELDS: readonly SortField[] = ['name', 'chargeCode', 'startDate', 'endDate'];

export type ProjectListState =
  | { status: 'loading' }
  | { status: 'loaded'; page: ProjectPage }
  | { status: 'error'; problem: ApiProblem };

export interface ListQuery {
  search: string;
  sort: SortField;
  order: SortOrder;
  page: number;
}

const UNEXPECTED: ApiProblem = {
  status: 0,
  code: 'UNEXPECTED',
  title: 'Something went wrong',
  detail: 'Please try again.',
  errors: [],
};

function readQuery(params: URLSearchParams): ListQuery {
  const sort = params.get('sort') as SortField | null;
  const page = Number(params.get('page'));
  return {
    search: params.get('search')?.trim() ?? '',
    sort: sort && SORT_FIELDS.includes(sort) ? sort : 'name',
    order: params.get('order') === 'desc' ? 'desc' : 'asc',
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

/** List state kept in the URL query so searches, sorting, and pages can be shared and revisited. */
export function useProjectList() {
  const [params, setParams] = useSearchParams();
  const query = readQuery(params);
  const { search, sort, order, page } = query;
  const [searchInput, setSearchInput] = useState(search);
  const [syncedSearch, setSyncedSearch] = useState(search);
  if (search !== syncedSearch) {
    // The URL changed (e.g. Back); show its term unless it is just the trimmed input.
    setSyncedSearch(search);
    if (searchInput.trim() !== search) setSearchInput(search);
  }
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${search}|${sort}|${order}|${page}|${attempt}`;
  const [result, setResult] = useState<{ key: string; state: ProjectListState } | null>(null);

  const update = useCallback(
    (changes: Partial<ListQuery>) => {
      setParams((current) => {
        const next = { ...readQuery(current), page: 1, ...changes };
        const out = new URLSearchParams();
        if (next.search) out.set('search', next.search);
        if (next.sort !== 'name') out.set('sort', next.sort);
        if (next.order !== 'asc') out.set('order', next.order);
        if (next.page > 1) out.set('page', String(next.page));
        return out;
      });
    },
    [setParams],
  );

  useEffect(() => {
    let active = true;
    listProjects({ search: search || undefined, sort, order, page, pageSize: PAGE_SIZE }).then(
      (data) => {
        if (active) setResult({ key: requestKey, state: { status: 'loaded', page: data } });
      },
      (error: unknown) => {
        const problem = error instanceof ApiError ? error.problem : UNEXPECTED;
        if (active) setResult({ key: requestKey, state: { status: 'error', problem } });
      },
    );
    return () => {
      active = false;
    };
  }, [search, sort, order, page, requestKey]);

  useEffect(() => {
    if (searchInput.trim() === search) return;
    const timer = setTimeout(() => update({ search: searchInput.trim() }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, search, update]);

  const state: ProjectListState = result?.key === requestKey ? result.state : { status: 'loading' };

  return {
    query,
    state,
    searchInput,
    setSearchInput,
    submitSearch: () => update({ search: searchInput.trim() }),
    clearSearch: () => {
      setSearchInput('');
      update({ search: '' });
    },
    sortBy: (field: SortField) =>
      update({ sort: field, order: field === sort && order === 'asc' ? 'desc' : 'asc' }),
    goToPage: (next: number) => update({ page: next }),
    retry: () => setAttempt((n) => n + 1),
  };
}
