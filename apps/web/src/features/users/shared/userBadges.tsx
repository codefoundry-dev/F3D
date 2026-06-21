import { cn } from '@forethread/ui-components';
import CartIcon from '@forethread/ui-components/assets/icons/cart.svg?react';
import CoinsIcon from '@forethread/ui-components/assets/icons/coins.svg?react';
import HammerIcon from '@forethread/ui-components/assets/icons/hammer.svg?react';
import IdBadgeIcon from '@forethread/ui-components/assets/icons/id-badge.svg?react';
import PackageIcon from '@forethread/ui-components/assets/icons/package.svg?react';
import ShieldIcon from '@forethread/ui-components/assets/icons/shield-icon.svg?react';
import SuppliersIcon from '@forethread/ui-components/assets/icons/suppliers.svg?react';
import UserIcon from '@forethread/ui-components/assets/icons/user-outline.svg?react';
import type { ComponentType, SVGProps } from 'react';

/**
 * User-domain role & status badges — the fleshed-out design-system pills shared
 * by every user-management surface (super-admin, company-admin, vendor, company
 * detail). Centralised here so the three role variants render identically.
 *
 * - Role badge: neutral gradient-white pill + a role-coloured icon + neutral text.
 * - Status badge: tonal gradient pill (rounded-full) + coloured dot + coloured text.
 */
type IconType = ComponentType<SVGProps<SVGSVGElement>>;

const ROLE_ICON: Record<string, { Icon: IconType; color: string }> = {
  SUPER_ADMIN: { Icon: ShieldIcon, color: 'text-purple-600' },
  COMPANY_ADMIN: { Icon: IdBadgeIcon, color: 'text-blue-600' },
  PROCUREMENT_OFFICER: { Icon: CartIcon, color: 'text-indigo-600' },
  FINANCIAL_OFFICER: { Icon: CoinsIcon, color: 'text-teal-600' },
  FOREMAN: { Icon: HammerIcon, color: 'text-warning-600' },
  WAREHOUSE_OFFICER: { Icon: PackageIcon, color: 'text-orange-600' },
  VENDOR: { Icon: SuppliersIcon, color: 'text-pink-600' },
};

const ROLE_PILL =
  'inline-flex h-7 items-center gap-2 rounded-[10px] border border-gray-100 bg-gradient-to-b from-[#F9F9FA] to-white px-[7px] text-sm font-medium text-gray-700 shadow-[0_1px_3px_0_rgba(10,13,18,0.06),0_1px_1px_0_rgba(10,13,18,0.02)]';

export interface RoleBadgeProps {
  role: string;
  label: string;
  className?: string;
}

export function RoleBadge({ role, label, className }: RoleBadgeProps) {
  const { Icon, color } = ROLE_ICON[role] ?? { Icon: UserIcon, color: 'text-gray-500' };
  return (
    <span className={cn(ROLE_PILL, className)}>
      <Icon className={cn('size-4 shrink-0', color)} aria-hidden />
      <span className="whitespace-nowrap">{label}</span>
    </span>
  );
}

const STATUS_STYLES: Record<string, { wrap: string; dot: string; text: string }> = {
  ACTIVE: {
    wrap: 'from-success-100 to-success-25 border-success-200',
    dot: 'bg-success-500 border-success-700',
    text: 'text-success-600',
  },
  INVITED: {
    wrap: 'from-blue-100 to-blue-25 border-blue-200',
    dot: 'bg-blue-500 border-blue-700',
    text: 'text-blue-600',
  },
  INACTIVE: {
    wrap: 'from-gray-100 to-gray-25 border-gray-200',
    dot: 'bg-gray-400 border-gray-500',
    text: 'text-gray-600',
  },
};

const STATUS_PILL =
  'inline-flex h-7 items-center gap-2 rounded-full border bg-gradient-to-b px-[7px] text-sm font-medium shadow-[0_1px_3px_0_rgba(10,13,18,0.06),0_1px_1px_0_rgba(10,13,18,0.02)]';

export interface StatusBadgeProps {
  status: string;
  label: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.INACTIVE;
  return (
    <span className={cn(STATUS_PILL, s.wrap, s.text, className)}>
      <span className={cn('size-2.5 shrink-0 rounded-full border', s.dot)} aria-hidden />
      <span className="whitespace-nowrap">{label}</span>
    </span>
  );
}
