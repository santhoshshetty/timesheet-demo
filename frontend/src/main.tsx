import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { NotificationProvider } from './app/NotificationProvider';
import { routes } from './app/routes';
import { theme } from './app/theme';

const router = createBrowserRouter(routes);

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

createRoot(container).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <NotificationProvider>
        <RouterProvider router={router} />
      </NotificationProvider>
    </ThemeProvider>
  </StrictMode>,
);
