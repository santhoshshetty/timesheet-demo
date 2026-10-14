import { createTheme } from '@mui/material/styles';

const focusOutline = {
  outline: '2px solid #1F4E79',
  outlineOffset: 2,
};

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1F4E79', contrastText: '#FFFFFF' },
    secondary: { main: '#4A5568', contrastText: '#FFFFFF' },
    error: { main: '#B42318' },
    warning: { main: '#8A5A00' },
    background: { default: '#F5F6F8', paper: '#FFFFFF' },
    text: { primary: '#1A202C', secondary: '#4A5568' },
  },
  typography: {
    fontFamily: '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSize: 14,
    h1: { fontSize: '1.75rem', fontWeight: 600 },
    h2: { fontSize: '1.125rem', fontWeight: 600 },
  },
  shape: { borderRadius: 6 },
  components: {
    MuiButtonBase: {
      styleOverrides: { root: { '&.Mui-focusVisible': focusOutline } },
    },
    MuiLink: {
      styleOverrides: { root: { '&:focus-visible': focusOutline } },
    },
    MuiTable: { defaultProps: { size: 'small' } },
    MuiPaper: { defaultProps: { variant: 'outlined' } },
  },
});
