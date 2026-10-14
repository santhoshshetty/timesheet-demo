import { useEffect } from 'react';

export const APP_NAME = 'timesheet-demo';

export function usePageTitle(pageName: string): void {
  useEffect(() => {
    document.title = `${pageName} – ${APP_NAME}`;
  }, [pageName]);
}
