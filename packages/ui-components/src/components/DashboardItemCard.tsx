import type { ReactNode } from 'react';

import PaperclipIcon from '../assets/icons/paperclip.svg?react';

import { MessageBadgeIcon } from './MessageBadgeIcon';

export interface MetadataField {
  icon: ReactNode;
  value: string;
}

export interface DashboardItemCardProps {
  /** Company/vendor name */
  name: string;
  /** Optional status badge */
  statusBadge?: ReactNode;
  /** Show chat icon with optional notification dot */
  hasChat?: boolean;
  /** Show notification dot on chat icon */
  hasChatNotification?: boolean;
  /** Show paperclip/attachment icon */
  hasAttachment?: boolean;
  /** Callback when message icon is clicked */
  onMessageClick?: () => void;
  /** Callback when attachment icon is clicked */
  onAttachmentClick?: () => void;
  /** Callback when the card body is clicked (navigates to detail) */
  onCardClick?: () => void;
  /** Action buttons on the right side of the header */
  actions?: ReactNode;
  /** Metadata fields displayed in a 3-column grid with icons */
  fields: MetadataField[];
}

export function DashboardItemCard({
  name,
  statusBadge,
  hasChat = true,
  hasChatNotification = false,
  hasAttachment = false,
  onMessageClick,
  onAttachmentClick,
  onCardClick,
  actions,
  fields,
}: DashboardItemCardProps) {
  return (
    <div
      className={`rounded-lg border border-border p-3 overflow-hidden transition-[box-shadow,border-color]${onCardClick ? ' cursor-pointer hover:border-border-hover hover:ring-1 hover:ring-border-hover' : ''}`}
      onClick={onCardClick}
      role={onCardClick ? 'button' : undefined}
      tabIndex={onCardClick ? 0 : undefined}
      onKeyDown={
        onCardClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onCardClick();
              }
            }
          : undefined
      }
    >
      {/* Header row */}
      <div className="flex items-center gap-3">
        <div className="flex flex-1 items-center gap-3 min-w-0">
          <span className="text-sm font-semibold text-foreground whitespace-nowrap">{name}</span>
          {statusBadge}
          {hasChat && (
            <span
              role="presentation"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <MessageBadgeIcon hasNotification={hasChatNotification} onClick={onMessageClick} />
            </span>
          )}
          {hasAttachment && (
            <span
              role="presentation"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                onClick={onAttachmentClick}
              >
                <PaperclipIcon className="w-4 h-4" />
              </button>
            </span>
          )}
        </div>
        {actions && (
          <div
            role="presentation"
            className="flex items-center gap-3 shrink-0"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        )}
      </div>

      {/* Metadata grid: 3 cols → 2 cols → 1 col */}
      <div className="mt-3 py-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3">
        {fields.map((field, idx) => (
          <div key={idx} className="flex items-center gap-2 min-w-0">
            <span className="shrink-0 w-[18px] h-[18px] flex items-center justify-center text-foreground">
              {field.icon}
            </span>
            <span className="text-sm text-foreground truncate">{field.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
