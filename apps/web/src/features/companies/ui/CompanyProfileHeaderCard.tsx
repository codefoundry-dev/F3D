import type { CompanyResponse } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { cn, Spinner } from '@forethread/ui-components';
import CameraIcon from '@forethread/ui-components/assets/icons/image.svg?react';
import EnvelopeIcon from '@forethread/ui-components/assets/icons/envelope-simple.svg?react';
import type { ReactNode } from 'react';

interface CompanyProfileHeaderCardProps {
  company: CompanyResponse;
  /** Resolved logo URL (e.g. from useCompanyLogo). Falls back to company.logoUrl. */
  logoUrl?: string | null;
  /** Active (green dot) user count pill. */
  activeCount?: number;
  /** Inactive (grey dot) user count pill. */
  inactiveCount?: number;
  /** Right-side action buttons (Invite user + ⋮ menu, or edit save/cancel). */
  actions?: ReactNode;
  /** When provided, the avatar becomes a click-to-upload button. */
  onAvatarClick?: () => void;
  isUploadingLogo?: boolean;
  className?: string;
}

/**
 * Company profile header card (US 1.09, Figma node 4384:95690).
 *
 * `layer/light` rounded-18 card holding a 144px company avatar, the company
 * name (Headline/S), a contact-email row, and active/inactive user-count pills,
 * with an `actions` slot on the right for the Invite-user button and ⋮ menu.
 */
export function CompanyProfileHeaderCard({
  company,
  logoUrl,
  activeCount,
  inactiveCount,
  actions,
  onAvatarClick,
  isUploadingLogo,
  className,
}: CompanyProfileHeaderCardProps) {
  const { t } = useTranslation('company');

  const resolvedLogo = logoUrl ?? company.logoUrl;
  const initials =
    company.legalName
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?';

  const avatarInner = resolvedLogo ? (
    <img
      src={resolvedLogo}
      alt={company.legalName}
      className="size-full rounded-full object-cover"
    />
  ) : (
    <span className="flex size-full items-center justify-center rounded-full bg-gray-100 text-3xl font-semibold text-gray-600">
      {initials}
    </span>
  );

  const avatarShell =
    'relative size-[140px] shrink-0 overflow-hidden rounded-full border-4 border-white shadow-[0_1px_3px_0_rgba(10,13,18,0.1),0_1px_1px_0_rgba(10,13,18,0.06)]';

  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-4 rounded-[18px] border border-[#e8eaed] bg-[#f9f9fa] p-4 shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)]',
        className,
      )}
    >
      {/* Left: avatar + company info */}
      <div className="flex min-w-0 flex-1 items-center gap-6 p-2">
        {onAvatarClick ? (
          <button
            type="button"
            onClick={onAvatarClick}
            disabled={isUploadingLogo}
            aria-label="Change avatar"
            className={cn(avatarShell, 'group')}
          >
            {avatarInner}
            <span className="absolute inset-0 hidden items-center justify-center rounded-full bg-black/40 text-white group-hover:flex">
              {isUploadingLogo ? <Spinner size="sm" /> : <CameraIcon className="size-6" />}
            </span>
            {isUploadingLogo && (
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white">
                <Spinner size="sm" />
              </span>
            )}
          </button>
        ) : (
          <div className={avatarShell}>{avatarInner}</div>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <h2 className="truncate text-[32px] font-medium leading-[1.4] tracking-[0.3px] text-gray-900">
              {company.legalName}
            </h2>
            {company.contactEmail && (
              <div className="flex min-w-0 items-center gap-2 text-base font-medium leading-[1.4] tracking-[0.3px] text-gray-500">
                <EnvelopeIcon className="size-[18px] shrink-0" />
                <span className="truncate">{company.contactEmail}</span>
              </div>
            )}
          </div>

          {(activeCount !== undefined || inactiveCount !== undefined) && (
            <div className="flex flex-wrap items-center gap-2">
              {activeCount !== undefined && (
                <CountPill dotClass="bg-[#16b364] border-[#087443]">
                  {t('usersCount', { count: activeCount })}
                </CountPill>
              )}
              {inactiveCount !== undefined && (
                <CountPill dotClass="bg-[#999fad] border-[#6d7588]">
                  {t('usersCount', { count: inactiveCount })}
                </CountPill>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: actions */}
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

function CountPill({ dotClass, children }: { dotClass: string; children: ReactNode }) {
  return (
    <span className="inline-flex h-7 items-center gap-2 rounded-[10px] border border-[#e8eaed] bg-gradient-to-b from-[#f9f9fa] to-white px-[7px] text-sm font-medium leading-[1.4] tracking-[0.3px] text-gray-500 shadow-[0_1px_3px_0_rgba(10,13,18,0.06),0_1px_1px_0_rgba(10,13,18,0.02)]">
      <span className={cn('size-2.5 shrink-0 rounded-full border', dotClass)} />
      {children}
    </span>
  );
}
