import Button from '@mui/material/Button';
import { Link as RouterLink } from 'react-router';
import { EmptyState } from '../shared/EmptyState';
import { PageHeader } from '../shared/PageHeader';
import { usePageTitle } from './usePageTitle';

export function NotFoundPage() {
  usePageTitle('Page not found');
  return (
    <>
      <PageHeader title="Page not found" />
      <EmptyState
        title="We couldn't find that page"
        message="Check the address, or go back to the project list."
        action={
          <Button component={RouterLink} to="/projects" variant="contained">
            Back to projects
          </Button>
        }
      />
    </>
  );
}
