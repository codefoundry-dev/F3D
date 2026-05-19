export enum ComponentStatus {
  HEALTHY = 'Healthy',
  ERROR = 'Error',
  WARNING = 'Warning',
  DISABLED = 'Disabled',
}

export type SortKey = 'component' | 'status' | 'lastSuccessfulRun' | 'lastError' | 'errorInfo';
