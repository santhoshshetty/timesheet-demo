import { Router } from 'express';
import type { ProjectInput as ProjectInputDto, ProjectPage } from '@timesheet/api-contract';
import type { CreateProject } from '../../application/project/createProject';
import type { DeleteProject } from '../../application/project/deleteProject';
import type { GetProject } from '../../application/project/getProject';
import type { ListProjects } from '../../application/project/listProjects';
import type { UpdateProject } from '../../application/project/updateProject';
import type { SortField, SortOrder } from '../../domain/project/ports';
import { InvalidIfMatchError, PreconditionRequiredError } from '../httpErrors';
import { toETag, toProjectDto } from '../mappers/projectMapper';

export interface ProjectUseCases {
  createProject: CreateProject;
  getProject: GetProject;
  listProjects: ListProjects;
  updateProject: UpdateProject;
  deleteProject: DeleteProject;
}

const IF_MATCH = /^"([1-9][0-9]{0,9})"$/;

/** The schema marks If-Match optional so this handler, not the validator, enforces it. */
function expectedVersionFrom(header: string | undefined): number {
  if (header === undefined) throw new PreconditionRequiredError();
  const match = IF_MATCH.exec(header.trim());
  if (!match) throw new InvalidIfMatchError();
  return Number(match[1]);
}

export function projectRoutes(useCases: ProjectUseCases): Router {
  const router = Router();

  router.get('/projects', async (req, res) => {
    // Values were validated against the contract; defaults are applied here.
    const query = req.query as Record<string, string | undefined>;
    const result = await useCases.listProjects({
      search: query.search,
      sort: (query.sort ?? 'name') as SortField,
      order: (query.order ?? 'asc') as SortOrder,
      page: Number(query.page ?? 1),
      pageSize: Number(query.pageSize ?? 25),
    });
    const body: ProjectPage = { ...result, items: result.items.map(toProjectDto) };
    res.json(body);
  });
  router.post('/projects', async (req, res) => {
    // Presence and UUID format are enforced by the OpenAPI validator.
    const createRequestId = req.header('Idempotency-Key') ?? '';
    const { project, replayed } = await useCases.createProject({
      input: req.body as ProjectInputDto,
      createRequestId,
    });
    res
      .status(replayed ? 200 : 201)
      .location(`/api/v1/projects/${project.id}`)
      .set('ETag', toETag(project.version))
      .json(toProjectDto(project));
  });

  router.get('/projects/:projectId', async (req, res) => {
    const project = await useCases.getProject(req.params.projectId);
    res.set('ETag', toETag(project.version)).json(toProjectDto(project));
  });

  router.put('/projects/:projectId', async (req, res) => {
    const expectedVersion = expectedVersionFrom(req.header('If-Match'));
    const project = await useCases.updateProject({
      id: req.params.projectId,
      input: req.body as ProjectInputDto,
      expectedVersion,
    });
    res.set('ETag', toETag(project.version)).json(toProjectDto(project));
  });

  router.delete('/projects/:projectId', async (req, res) => {
    await useCases.deleteProject(req.params.projectId);
    res.status(204).end();
  });

  return router;
}
