import type { BillingType, ProjectType } from '@timesheet/api-contract';

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  INTERNAL: 'Internal Project',
  CLIENT: 'Client Project',
};

export const BILLING_TYPE_LABELS: Record<BillingType, string> = {
  BILLABLE: 'Billable',
  NON_BILLABLE: 'Non-Billable',
};
