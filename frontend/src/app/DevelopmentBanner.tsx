import Alert from '@mui/material/Alert';

export const DEVELOPMENT_BANNER_TEXT =
  'Development environment — no sign-in. Do not enter confidential data.';

export function DevelopmentBanner() {
  return (
    <Alert severity="warning" role="note" square sx={{ justifyContent: 'center' }}>
      {DEVELOPMENT_BANNER_TEXT}
    </Alert>
  );
}
