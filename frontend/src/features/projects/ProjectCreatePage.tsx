import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import { useNavigate } from 'react-router';
import { ApiError, type ApiProblem } from '../../api/client';
import { newIdempotencyKey } from '../../api/idempotencyKey';
import { useNotify } from '../../app/NotificationProvider';
import { usePageTitle } from '../../app/usePageTitle';
import { ErrorState } from '../../shared/ErrorState';
import { PageHeader } from '../../shared/PageHeader';
import { createProject } from './api';
import { localToday } from './format';
import { ProjectForm } from './ProjectForm';
import {
  EMPTY_PROJECT_FORM,
  startDateHint,
  toFieldErrors,
  toProjectInput,
  validateProjectForm,
  type FieldErrors,
} from './validation';

const UNEXPECTED: ApiProblem = {
  status: 0,
  code: 'UNEXPECTED',
  title: 'Something went wrong',
  detail: 'Please try again.',
  errors: [],
};

export function ProjectCreatePage() {
  usePageTitle('Create project');
  const navigate = useNavigate();
  const notify = useNotify();
  // One key per form instance so retries and double submits never create duplicates (FR-009).
  const [idempotencyKey] = useState(() => newIdempotencyKey());
  const [values, setValues] = useState(EMPTY_PROJECT_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [summaryRequest, setSummaryRequest] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [requestError, setRequestError] = useState<ApiProblem | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

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
    const clientErrors = validateProjectForm(values);
    if (Object.keys(clientErrors).length > 0) {
      showFieldErrors(clientErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const { project, replayed } = await createProject(toProjectInput(values), idempotencyKey);
      notify(
        replayed
          ? 'This project was already created. Showing the saved project.'
          : `Project created. Charge code ${project.chargeCode}.`,
      );
      void navigate(`/projects/${project.id}`);
    } catch (error) {
      const problem = error instanceof ApiError ? error.problem : UNEXPECTED;
      const fieldErrors = toFieldErrors(problem.errors);
      if (fieldErrors) showFieldErrors(fieldErrors);
      else setRequestError(problem);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Create project"
        breadcrumbs={[{ label: 'Projects', to: '/projects' }, { label: 'Create project' }]}
      />
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
        startDateHint={startDateHint(values, localToday())}
        submitting={submitting}
        submitLabel="Create project"
        onChange={setValues}
        onSubmit={() => void submit()}
        onCancel={() => void navigate('/projects')}
      />
    </>
  );
}
