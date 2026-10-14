import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import type { ApiProblem } from '../api/client';

interface ErrorStateProps {
  title?: string;
  problem?: ApiProblem;
  onRetry?: () => void;
}

export function ErrorState({ title, problem, onRetry }: ErrorStateProps) {
  return (
    <Alert
      severity="error"
      action={
        onRetry && (
          <Button color="inherit" size="small" onClick={onRetry}>
            Retry
          </Button>
        )
      }
    >
      <AlertTitle>{title ?? problem?.title ?? 'Something went wrong'}</AlertTitle>
      {problem?.detail ?? 'Please try again.'}
      {problem?.requestId && (
        <Typography variant="body2" sx={{ mt: 1 }}>
          Request ID: {problem.requestId}
        </Typography>
      )}
    </Alert>
  );
}
