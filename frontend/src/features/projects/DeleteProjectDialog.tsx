import { useState } from 'react';
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
import { ApiError, type ApiProblem } from '../../api/client';
import { ErrorState } from '../../shared/ErrorState';
import { deleteProject } from './api';
import { ChargeCodeText } from './ChargeCodeText';

interface DeleteProjectDialogProps {
  project: Project;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

const UNEXPECTED: ApiProblem = {
  status: 0,
  code: 'UNEXPECTED',
  title: 'Something went wrong',
  detail: 'Please try again.',
  errors: [],
};

export function DeleteProjectDialog({
  project,
  open,
  onClose,
  onDeleted,
}: DeleteProjectDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [problem, setProblem] = useState<ApiProblem | null>(null);

  const close = () => {
    if (deleting) return;
    setProblem(null);
    onClose();
  };

  const confirm = async () => {
    setDeleting(true);
    setProblem(null);
    try {
      await deleteProject(project.id);
      onDeleted();
    } catch (error) {
      setProblem(error instanceof ApiError ? error.problem : UNEXPECTED);
      setDeleting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      aria-labelledby="delete-project-title"
      aria-describedby="delete-project-description"
    >
      <DialogTitle id="delete-project-title">Delete project?</DialogTitle>
      <DialogContent>
        <DialogContentText id="delete-project-description">
          <strong>{project.name}</strong> (charge code <ChargeCodeText code={project.chargeCode} />)
          will be removed from all project lists and searches. Its charge code will not be reused.
        </DialogContentText>
        {problem && (
          <Box sx={{ mt: 2 }}>
            {problem.status === 404 ? (
              <Alert severity="error">
                <AlertTitle>Project not found</AlertTitle>
                It may already have been deleted.
              </Alert>
            ) : (
              <ErrorState title="The project was not deleted" problem={problem} />
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={close} disabled={deleting}>
          Cancel
        </Button>
        <Button
          color="error"
          variant="contained"
          disabled={deleting || problem?.status === 404}
          onClick={() => void confirm()}
        >
          {deleting ? 'Deleting…' : 'Delete project'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
