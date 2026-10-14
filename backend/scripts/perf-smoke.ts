import { randomInt, randomUUID } from 'node:crypto';
import type { Project, ProjectInput, ProjectPage } from '@timesheet/api-contract';

const BASE_URL = process.env.PERF_BASE_URL ?? 'http://localhost:3000';
const SEED_COUNT = Number(process.env.PERF_SEED_COUNT ?? 10_000);
const SAMPLES = 200;
const MAX_IN_FLIGHT = 20;
const TARGETS_MS = { create: 300, get: 300, update: 300, search: 500 } as const;
type Operation = keyof typeof TARGETS_MS;

const runId = `${Date.now()}${randomInt(1000, 9999)}`;
const today = new Date().toISOString().slice(0, 10);

function input(index: number): ProjectInput {
  const client = index % 2 === 0;
  return {
    name: `perf-${runId}-${index}`,
    projectManager: { name: `Manager ${index % 50}`, email: `manager${index % 50}@example.com` },
    startDate: today,
    endDate: today,
    projectType: client ? 'CLIENT' : 'INTERNAL',
    clientName: client ? `Client ${index % 100}` : null,
    billingType: index % 3 === 0 ? 'NON_BILLABLE' : 'BILLABLE',
  };
}

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
}

async function create(index: number): Promise<Project> {
  const res = await call('/api/v1/projects', {
    method: 'POST',
    headers: { 'Idempotency-Key': randomUUID() },
    body: JSON.stringify(input(index)),
  });
  if (res.status !== 201) {
    throw new Error(`Create #${index} returned ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as Project;
}

/** Runs `task` for 0..count-1 with at most MAX_IN_FLIGHT concurrent calls. */
async function inPool<T>(count: number, task: (index: number) => Promise<T>): Promise<T[]> {
  const results = new Array<T>(count);
  let next = 0;
  const worker = async () => {
    while (next < count) {
      const index = next++;
      results[index] = await task(index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(MAX_IN_FLIGHT, count) }, worker));
  return results;
}

async function timed(fn: () => Promise<Response>, expected: number): Promise<number> {
  const start = performance.now();
  const res = await fn();
  await res.arrayBuffer();
  const elapsed = performance.now() - start;
  if (res.status !== expected) {
    throw new Error(`Expected ${expected}, got ${res.status} for ${res.url}`);
  }
  return elapsed;
}

function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? 0;
}

async function main(): Promise<void> {
  console.log(`Seeding ${SEED_COUNT} projects against ${BASE_URL} (run ${runId})...`);
  const seeded = await inPool(SEED_COUNT, create);

  const pick = () => seeded[randomInt(0, seeded.length)]!;
  const searchTerms = (i: number): string => {
    const project = pick();
    switch (i % 4) {
      case 0:
        return project.name.slice(-6);
      case 1:
        return project.chargeCode.slice(0, 4);
      case 2:
        return project.projectManager.email;
      default:
        return `Client ${i % 100}`;
    }
  };

  const samples: Record<Operation, number[]> = { create: [], get: [], update: [], search: [] };
  for (let i = 0; i < SAMPLES; i++) {
    samples.create.push(
      await timed(
        () =>
          call('/api/v1/projects', {
            method: 'POST',
            headers: { 'Idempotency-Key': randomUUID() },
            body: JSON.stringify(input(SEED_COUNT + i)),
          }),
        201,
      ),
    );

    const target = pick();
    samples.get.push(await timed(() => call(`/api/v1/projects/${target.id}`), 200));

    // Seeded projects are never updated twice, so the version stays in step with each update.
    const current = seeded[i]!;
    const { id: _id, chargeCode: _c, version, createdAt: _ca, updatedAt: _u, ...fields } = current;
    samples.update.push(
      await timed(
        () =>
          call(`/api/v1/projects/${current.id}`, {
            method: 'PUT',
            headers: { 'If-Match': `"${version}"` },
            body: JSON.stringify({ ...fields, name: `${current.name}-updated` }),
          }),
        200,
      ),
    );

    const query = new URLSearchParams({ search: searchTerms(i) });
    samples.search.push(await timed(() => call(`/api/v1/projects?${query.toString()}`), 200));
  }

  let failed = false;
  for (const op of Object.keys(TARGETS_MS) as Operation[]) {
    const sorted = [...samples[op]].sort((a, b) => a - b);
    const p95 = percentile(sorted, 95);
    const ok = p95 < TARGETS_MS[op];
    failed ||= !ok;
    console.log(
      `${op.padEnd(7)} p50=${percentile(sorted, 50).toFixed(1)}ms p95=${p95.toFixed(1)}ms ` +
        `max=${sorted.at(-1)!.toFixed(1)}ms target<${TARGETS_MS[op]}ms ${ok ? 'PASS' : 'FAIL'}`,
    );
  }
  const page = (await (await call('/api/v1/projects?pageSize=1')).json()) as ProjectPage;
  console.log(`Active projects: ${page.totalItems}`);
  if (failed) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
