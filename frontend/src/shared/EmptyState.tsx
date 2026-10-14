import type { ReactNode } from 'react';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

interface EmptyStateProps {
  title: string;
  message?: string;
  action?: ReactNode;
}

export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <Paper sx={{ p: 4 }}>
      <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
        <Typography variant="h2" component="h2">
          {title}
        </Typography>
        {message && <Typography color="text.secondary">{message}</Typography>}
        {action}
      </Stack>
    </Paper>
  );
}
