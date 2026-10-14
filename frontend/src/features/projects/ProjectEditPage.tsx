import { useEffect, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import type { Project } from '@timesheet/api-contract';
import { Link as RouterLink, useBlocker, useNavigate, useParams } from 'react-router';
import { ApiError, type ApiProblem } from '../../api/client';
import { useNotify } from '../../app/NotificationProvider';
import { usePageTitle } from '../../app/usePageTitle';
import { EmptyState } from '../../shared/EmptyState';
import { ErrorState } from '../../shared/ErrorState';
import { LoadingState } from '../../shared/LoadingState';
import { PageHeader } from '../../shared/PageHeader';
import { updateProject } from './api';
import { localToday } from './format';
import { ProjectForm } from './ProjectForm';
import { useProject, type ProjectState } from './useProject';
import {
  startDateHint,
  toFieldErrors,
  toFormValues,
  toProjectInput,
  validateProjectForm,
  type FieldErrors,
  type ProjectFormValues,
} from './validation';

const LIST_CRUMB = { label: 'Projects', to: '/projects' };

const UNEXPECTED: ApiProblem = {
  status: 0,
  code: 'UNEXPECTED',
  title: 'Something went wrong',
  detail: 'Please try again.',
  errors: [],
};

function pageTitle(state: ProjectState): string {
  switch (state.status) {
    case 'loading':
      return 'Loading project';
    case 'loaded':
      return `Edit ${state.project.name}`;
    case 'not-found':
      return 'Project not found';
    case 'error':
      return 'Project could not be loaded';
  }
}

function sameValues(a: ProjectFormValues, b: ProjectFormValues): boolean {
  return (Object.keys(a) as Array<keyof ProjectFormValues>).every((key) => a[key] === b[key]);
}

export function ProjectEditPage() {
  const { projectId } = useParams();
  const { state, reload } = useProject(projectId);
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
        <EditProjectForm
          key={state.etag ?? state.project.version}
          project={state.project}
          etag={state.etag ?? `"${state.project.version}"`}
          onReload={reload}
        />
      );
  }
}

interface EditProjectFormProps {
  project: Project;
  etag: string;
  onReload: () => void;
}

function EditProjectForm({ project, etag, onReload }: EditProjectFormProps) {
  const navigate = useNavigate();
  const notify = useNotify();
  const [initial] = useState(() => toFormValues(project));
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [summaryRequest, setSummaryRequest] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [requestError, setRequestError] = useState<ApiProblem | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const savedRef = useRef(false);
  const detailPath = `/projects/${project.id}`;

  const dirty = !sameValues(values, initial);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !savedRef.current && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => {
    if (summaryRequest > 0) summaryRef.current?.focus();
  }, [summaryRequest]);

  const showFieldErrors = (fieldErrors: FieldErrors) => {
    setErrors(fieldErrors);
    setSummaryRequest((n) => n + 1);
  };

  const submit = async () => {
    if (submitting) return;
    setRequestError(null);
    setConflict(false);
    const clientErrors = validateProjectForm(values);
    if (Object.keys(clientErrors).length > 0) {
      showFieldErrors(clientErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      await updateProject(project.id, toProjectInput(values), etag);
      savedRef.current = true;
      notify('Project updated.');
      void navigate(detailPath);
    } catch (error) {
      const problem = error instanceof ApiError ? error.problem : UNEXPECTED;
      const fieldErrors = toFieldErrors(problem.errors);
      if (problem.status === 412) setConflict(true);
      else if (problem.status === 404) onReload();
      else if (fieldErrors) showFieldErrors(fieldErrors);
      else setRequestError(problem);
    } finally {
      setSubmitting(false);
    }
  };

  const hint =
    values.startDate === project.startDate ? undefined : startDateHint(values, localToday());

  return (
    <>
      <PageHeader
        title={`Edit ${project.name}`}
        breadcrumbs={[LIST_CRUMB, { label: project.name, to: detailPath }, { label: 'Edit' }]}
      />
      {conflict && (
        <Alert
          severity="warning"
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={onReload}>
              Reload
            </Button>
          }
        >
          <AlertTitle>This project was changed by someone else</AlertTitle>
          Reload to see the latest version. Your unsaved changes will be lost.
        </Alert>
      )}
      {requestError && (
        <Box sx={{ mb: 3 }}>
          <ErrorState
            title="The project was not saved"
            problem={requestError}
            onRetry={() => void submit()}
          />
        </Box>
      )}
      <ProjectForm
        values={values}
        errors={errors}
        showErrorSummary={summaryRequest > 0}
        errorSummaryRef={summaryRef}
        startDateHint={hint}
        chargeCode={project.chargeCode}
        submitting={submitting}
        submitLabel="Save changes"
        onChange={setValues}
        onSubmit={() => void submit()}
        onCancel={() => void navigate(detailPath)}
      />
      <Dialog
        open={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        aria-labelledby="discard-changes-title"
      >
        <DialogTitle id="discard-changes-title">Discard unsaved changes?</DialogTitle>
        <DialogContent>
          <DialogContentText>Your changes to this project have not been saved.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => blocker.reset?.()}>Keep editing</Button>
          <Button color="error" onClick={() => blocker.proceed?.()}>
            Discard changes
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
