import { useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { Project } from '@timesheet/api-contract';
import { Link as RouterLink, useNavigate, useParams } from 'react-router';
import { useNotify } from '../../app/NotificationProvider';
import { usePageTitle } from '../../app/usePageTitle';
import { EmptyState } from '../../shared/EmptyState';
import { ErrorState } from '../../shared/ErrorState';
import { LoadingState } from '../../shared/LoadingState';
import { PageHeader } from '../../shared/PageHeader';
import { ChargeCodeText } from './ChargeCodeText';
import { DeleteProjectDialog } from './DeleteProjectDialog';
import { formatDate } from './format';
import { BILLING_TYPE_LABELS, PROJECT_TYPE_LABELS } from './labels';
import { useProject, type ProjectState } from './useProject';

const LIST_CRUMB = { label: 'Projects', to: '/projects' };

function pageTitle(state: ProjectState): string {
  switch (state.status) {
    case 'loading':
      return 'Loading project';
    case 'loaded':
      return `${state.project.name} – Project`;
    case 'not-found':
      return 'Project not found';
    case 'error':
      return 'Project could not be loaded';
  }
}

function DetailSection({ title, rows }: { title: string; rows: Array<[string, ReactNode]> }) {
  return (
    <Paper component="section" sx={{ p: 3 }}>
      <Typography variant="h2" component="h2" sx={{ mb: 2 }}>
        {title}
      </Typography>
      <Box
        component="dl"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '220px 1fr' },
          columnGap: 3,
          rowGap: 1.5,
          m: 0,
        }}
      >
        {rows.map(([label, value]) => (
          <Box key={label} sx={{ display: 'contents' }}>
            <Typography component="dt" color="text.secondary">
              {label}
            </Typography>
            <Typography component="dd" sx={{ m: 0 }}>
              {value}
            </Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}

function ProjectDetails({ project }: { project: Project }) {
  const general: Array<[string, ReactNode]> = [
    ['Charge code', <ChargeCodeText key="code" code={project.chargeCode} />],
    ['Project type', PROJECT_TYPE_LABELS[project.projectType]],
  ];
  if (project.projectType === 'CLIENT') general.push(['Client name', project.clientName ?? '']);
  general.push(['Billing type', BILLING_TYPE_LABELS[project.billingType]]);

  return (
    <Stack spacing={3}>
      <DetailSection title="General" rows={general} />
      <DetailSection
        title="Project manager"
        rows={[
          ['Name', project.projectManager.name],
          ['Email', project.projectManager.email],
        ]}
      />
      <DetailSection
        title="Schedule"
        rows={[
          ['Start date', formatDate(project.startDate)],
          ['End date', formatDate(project.endDate)],
        ]}
      />
    </Stack>
  );
}

export function ProjectDetailPage() {
  const { projectId } = useParams();
  const { state, reload } = useProject(projectId);
  const navigate = useNavigate();
  const notify = useNotify();
  const [deleteOpen, setDeleteOpen] = useState(false);
  usePageTitle(pageTitle(state));

  switch (state.status) {
    case 'loading':
      return <LoadingState label="Loading project…" />;
    case 'not-found':
      return (
        <>
          <PageHeader title="Project not found" breadcrumbs={[LIST_CRUMB]} />
          <EmptyState
            title="This project doesn't exist or has been deleted"
            action={
              <Button component={RouterLink} to="/projects" variant="contained">
                Back to projects
              </Button>
            }
          />
        </>
      );
    case 'error':
      return (
        <>
          <PageHeader title="Project could not be loaded" breadcrumbs={[LIST_CRUMB]} />
          <ErrorState problem={state.problem} onRetry={reload} />
        </>
      );
    case 'loaded':
      return (
        <>
          <PageHeader
            title={state.project.name}
            breadcrumbs={[LIST_CRUMB, { label: state.project.name }]}
            actions={
              <>
                <Button
                  component={RouterLink}
                  to={`/projects/${state.project.id}/edit`}
                  variant="contained"
                >
                  Edit
                </Button>
                <Button variant="outlined" color="error" onClick={() => setDeleteOpen(true)}>
                  Delete
                </Button>
              </>
            }
          />
          <ProjectDetails project={state.project} />
          <DeleteProjectDialog
            project={state.project}
            open={deleteOpen}
            onClose={() => setDeleteOpen(false)}
            onDeleted={() => {
              notify('Project deleted.');
              void navigate('/projects');
            }}
          />
        </>
      );
  }
}
