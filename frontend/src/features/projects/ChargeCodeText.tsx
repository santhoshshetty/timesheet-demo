import Box from '@mui/material/Box';

export function ChargeCodeText({ code }: { code: string }) {
  return (
    <Box
      component="span"
      sx={{ fontFamily: 'Consolas, "Courier New", monospace', letterSpacing: '0.05em' }}
    >
      {code}
    </Box>
  );
}
