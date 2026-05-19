import { useTranslation } from '@forethread/i18n';
import { Badge, Button } from '@forethread/ui-components';
import BriefcaseIcon from '@forethread/ui-components/assets/icons/briefcase.svg?react';
import DateIcon from '@forethread/ui-components/assets/icons/date.svg?react';
import DepartmentIcon from '@forethread/ui-components/assets/icons/department.svg?react';
import EditIcon from '@forethread/ui-components/assets/icons/edit-without-line.svg?react';
import HammerIcon from '@forethread/ui-components/assets/icons/hammer.svg?react';
import IdBadgeIcon from '@forethread/ui-components/assets/icons/id-badge.svg?react';
import PhoneIcon from '@forethread/ui-components/assets/icons/phone.svg?react';
import SuppliersIcon from '@forethread/ui-components/assets/icons/suppliers.svg?react';

export interface ProfileInfoGridProps {
  phone: string | null;
  status: string;
  role: string;
  createdAt: string;
  position: string | null;
  company?: string | null;
  /** Optional list of assigned projects (shown only in apps that manage project access) */
  projects?: { id: string; name: string }[];
  /** Callback for the "Project Access" button (shown only when projects are provided) */
  onProjectAccess?: () => void;
}

export function ProfileInfoGrid({
  phone,
  status,
  role,
  createdAt,
  position,
  company,
  projects,
  onProjectAccess,
}: ProfileInfoGridProps) {
  const { t } = useTranslation(['profile', 'users']);

  const hasProjects = projects && projects.length > 0;

  return (
    <div className="mt-8 space-y-6">
      <div className="grid grid-cols-4 gap-y-6">
        {/* Row 1 */}
        <InfoField label={t('phone')}>
          <PhoneIcon className="w-4 h-4 text-muted-foreground" />
          {phone ?? '\u2014'}
        </InfoField>

        <InfoField label={t('status')}>
          <Badge className="rounded bg-muted text-foreground text-xs">
            {t(`users:statuses.${status}` as 'users:statuses.ACTIVE')}
          </Badge>
        </InfoField>

        <InfoField label={t('role')}>
          <BriefcaseIcon className="w-4 h-4 text-muted-foreground" />
          {t(`users:roles.${role}` as 'users:roles.COMPANY_ADMIN')}
        </InfoField>

        <InfoField label={t('dateJoined')}>
          <DateIcon className="w-4 h-4 text-muted-foreground" />
          {new Date(createdAt).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </InfoField>

        {/* Row 2 */}
        <InfoField label={t('position')}>
          <IdBadgeIcon className="w-4 h-4 text-muted-foreground" />
          {position ?? t('positionPlaceholder')}
        </InfoField>

        <InfoField label={t('department')}>
          <DepartmentIcon className="w-4 h-4 text-muted-foreground" />
          {t('departmentPlaceholder')}
        </InfoField>

        {company !== null && company !== undefined && (
          <InfoField label={t('users:detail.company')}>
            <SuppliersIcon className="w-4 h-4 text-muted-foreground" />
            {company}
          </InfoField>
        )}
      </div>

      {/* Assigned project row — only shown when there are projects */}
      {hasProjects && (
        <div className="flex items-center justify-between">
          <InfoField label={t('assignedProject')}>
            <HammerIcon className="w-4 h-4 text-muted-foreground" />
            {projects.map((p) => p.name).join(', ')}
          </InfoField>
          {onProjectAccess && (
            <Button variant="outline" size="sm" onClick={onProjectAccess}>
              <EditIcon className="w-4 h-4 mr-2" />
              {t('projectAccess')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function InfoField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1.5">{label}</p>
      <div className="flex items-center gap-2 text-sm text-foreground">{children}</div>
    </div>
  );
}
