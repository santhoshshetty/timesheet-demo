import type { Project as ProjectDto } from '@timesheet/api-contract';
import type { Project } from '../../domain/project/Project';

export function toProjectDto(project: Project): ProjectDto {
  return {
    id: project.id,
    chargeCode: project.chargeCode.toString(),
    name: project.name,
    projectManager: project.projectManager,
    startDate: project.startDate.toString(),
    endDate: project.endDate.toString(),
    projectType: project.projectType,
    clientName: project.clientName,
    billingType: project.billingType,
    version: project.version,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

export function toETag(version: number): string {
  return `"${version}"`;
}
