import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TablePagination from '@mui/material/TablePagination';
import TextField from '@mui/material/TextField';
import { Link as RouterLink } from 'react-router';
import { usePageTitle } from '../../app/usePageTitle';
import { EmptyState } from '../../shared/EmptyState';
import { ErrorState } from '../../shared/ErrorState';
import { LoadingState } from '../../shared/LoadingState';
import { PageHeader } from '../../shared/PageHeader';
import { ProjectTable } from './ProjectTable';
import { PAGE_SIZE, useProjectList } from './useProjectList';

export function ProjectListPage() {
  usePageTitle('Projects');
  const list = useProjectList();
  const { state, query } = list;

  const results = () => {
    switch (state.status) {
      case 'loading':
        return <LoadingState label="Loading projects…" />;
      case 'error':
        return (
          <ErrorState
            title="Projects could not be loaded"
            problem={state.problem}
            onRetry={list.retry}
          />
        );
      case 'loaded': {
        const { page } = state;
        if (page.totalItems === 0 && query.search) {
          return (
            <EmptyState
              title="No matching projects"
              message={`No projects match "${query.search}".`}
              action={
                <Button variant="outlined" onClick={list.clearSearch}>
                  Clear search
                </Button>
              }
            />
          );
        }
        if (page.totalItems === 0) {
          return (
            <EmptyState
              title="No projects yet"
              message="Create the first project to get started."
              action={
                <Button component={RouterLink} to="/projects/new" variant="contained">
                  Create project
                </Button>
              }
            />
          );
        }
        return (
          <>
            <ProjectTable
              projects={page.items}
              sort={query.sort}
              order={query.order}
              onSort={list.sortBy}
            />
            <TablePagination
              component="div"
              count={page.totalItems}
              page={query.page - 1}
              rowsPerPage={PAGE_SIZE}
              rowsPerPageOptions={[]}
              onPageChange={(_event, next) => list.goToPage(next + 1)}
            />
          </>
        );
      }
    }
  };

  return (
    <>
      <PageHeader
        title="Projects"
        actions={
          <Button component={RouterLink} to="/projects/new" variant="contained">
            Create project
          </Button>
        }
      />
      <Box
        component="form"
        role="search"
        sx={{ mb: 3, maxWidth: 480 }}
        onSubmit={(event) => {
          event.preventDefault();
          list.submitSearch();
        }}
      >
        <TextField
          id="project-search"
          label="Search projects"
          type="search"
          fullWidth
          value={list.searchInput}
          onChange={(event) => list.setSearchInput(event.target.value)}
          helperText="Name, charge code, project manager, or client"
          slotProps={{ htmlInput: { maxLength: 100 } }}
        />
      </Box>
      {results()}
    </>
  );
}
