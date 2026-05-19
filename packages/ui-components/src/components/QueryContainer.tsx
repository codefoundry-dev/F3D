import React from 'react';

import { Spinner } from './Spinner';

export interface QueryContainerProps {
  isLoading: boolean;
  isEmpty: boolean;
  emptyMessage: string;
  children: React.ReactNode;
  /** Custom spinner size, defaults to 'md' */
  spinnerSize?: 'sm' | 'md' | 'lg';
  /** Use text-based loading instead of spinner */
  loadingMessage?: string;
}

export function QueryContainer({
  isLoading,
  isEmpty,
  emptyMessage,
  children,
  spinnerSize = 'md',
  loadingMessage,
}: QueryContainerProps) {
  if (isLoading) {
    if (loadingMessage) {
      return <div className="py-8 text-center text-sm text-muted-foreground">{loadingMessage}</div>;
    }
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={spinnerSize} />
      </div>
    );
  }

  if (isEmpty) {
    return <div className="py-12 text-center text-sm text-muted-foreground">{emptyMessage}</div>;
  }

  return <>{children}</>;
}
