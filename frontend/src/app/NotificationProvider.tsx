import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import Snackbar from '@mui/material/Snackbar';
import { visuallyHidden } from '../shared/visuallyHidden';

interface NotificationContextValue {
  notify: (message: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(false);

  const notify = useCallback((next: string) => {
    setMessage(next);
    setOpen(true);
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {/* Always mounted so screen readers announce changes politely. */}
      <div role="status" aria-live="polite" style={visuallyHidden}>
        {message}
      </div>
      <Snackbar
        open={open}
        autoHideDuration={6000}
        onClose={() => setOpen(false)}
        message={message}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ content: { 'aria-hidden': true } }}
      />
    </NotificationContext.Provider>
  );
}

export function useNotify(): (message: string) => void {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotify must be used inside NotificationProvider');
  return context.notify;
}
