import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { NavLink, Link as RouterLink, Outlet } from 'react-router';
import { DevelopmentBanner } from './DevelopmentBanner';
import { APP_NAME } from './usePageTitle';

export function App() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Link
        href="#main-content"
        sx={{
          position: 'absolute',
          left: -9999,
          '&:focus': { left: 8, top: 8, zIndex: 2000, bgcolor: 'background.paper', p: 1 },
        }}
      >
        Skip to main content
      </Link>
      <AppBar position="static" elevation={0}>
        <Toolbar sx={{ gap: 3 }}>
          <Typography
            component={RouterLink}
            to="/projects"
            variant="h6"
            sx={{ color: 'inherit', textDecoration: 'none', fontWeight: 600 }}
          >
            {APP_NAME}
          </Typography>
          <Box component="nav" aria-label="Main">
            <Button component={NavLink} to="/projects" color="inherit">
              Projects
            </Button>
          </Box>
        </Toolbar>
      </AppBar>
      <DevelopmentBanner />
      <Container component="main" id="main-content" tabIndex={-1} maxWidth="lg" sx={{ py: 4 }}>
        <Outlet />
      </Container>
    </Box>
  );
}
