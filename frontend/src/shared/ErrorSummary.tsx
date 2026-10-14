import type { Ref } from 'react';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Link from '@mui/material/Link';

export interface SummaryItem {
  fieldId: string;
  message: string;
}

interface ErrorSummaryProps {
  items: SummaryItem[];
  ref?: Ref<HTMLDivElement>;
}

/** Lists form errors as links that move focus to the field; receives focus when shown. */
export function ErrorSummary({ items, ref }: ErrorSummaryProps) {
  return (
    <Alert severity="error" ref={ref} tabIndex={-1} sx={{ mb: 3 }}>
      <AlertTitle>There is a problem</AlertTitle>
      <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
        {items.map((item) => (
          <li key={`${item.fieldId}-${item.message}`}>
            <Link
              href={`#${item.fieldId}`}
              color="inherit"
              onClick={(event) => {
                event.preventDefault();
                document.getElementById(item.fieldId)?.focus();
              }}
            >
              {item.message}
            </Link>
          </li>
        ))}
      </ul>
    </Alert>
  );
}
