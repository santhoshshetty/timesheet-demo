import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router';

export interface Breadcrumb {
  label: string;
  to?: string;
}

interface PageHeaderProps {
  title: string;
  breadcrumbs?: Breadcrumb[];
  actions?: ReactNode;
}

export function PageHeader({ title, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <Box component="header" sx={{ mb: 3 }}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs aria-label="Breadcrumb" sx={{ mb: 1 }}>
          {breadcrumbs.map((crumb) =>
            crumb.to ? (
              <Link key={crumb.label} component={RouterLink} to={crumb.to} underline="hover">
                {crumb.label}
              </Link>
            ) : (
              <Typography key={crumb.label} color="text.primary" aria-current="page">
                {crumb.label}
              </Typography>
            ),
          )}
        </Breadcrumbs>
      )}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}
      >
        <Typography variant="h1" component="h1">
          {title}
        </Typography>
        {actions && (
          <Stack direction="row" spacing={1}>
            {actions}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
