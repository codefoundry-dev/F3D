import { UserRole } from '@forethread/shared-types/client';
import type { SidebarNavItem } from '@forethread/ui-components';
import BulkOrdersIcon from '@forethread/ui-components/assets/icons/bulk-orders.svg?react';
import InvoiceIcon from '@forethread/ui-components/assets/icons/invoice.svg?react';
import MaterialCatalogueIcon from '@forethread/ui-components/assets/icons/material-catalogue.svg?react';
import ProjectsIcon from '@forethread/ui-components/assets/icons/projects.svg?react';
import PurchaseOrdersIcon from '@forethread/ui-components/assets/icons/purchase-orders.svg?react';
import RequestIcon from '@forethread/ui-components/assets/icons/request.svg?react';
import SettingsIcon from '@forethread/ui-components/assets/icons/settings.svg?react';
import VendorsIcon from '@forethread/ui-components/assets/icons/vendors.svg?react';

import { ROUTES } from '@/app/route-config';

/**
 * The full sidebar item list, each tagged with the roles that should see it.
 * AppLayout filters the list by the current user's role before passing it to
 * the `Sidebar` component.
 */
export interface RoleAwareSidebarItem extends Omit<SidebarNavItem, 'isActive'> {
  roles: readonly UserRole[];
  /** Optional matcher for active state. Defaults to startsWith(href). */
  matchPathname?: (pathname: string) => boolean;
}

const ALL_INTERNAL: readonly UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.COMPANY_ADMIN,
  UserRole.PROCUREMENT_OFFICER,
  UserRole.FINANCIAL_OFFICER,
  UserRole.WAREHOUSE_OFFICER,
  UserRole.FOREMAN,
];

const BUYER_SIDE: readonly UserRole[] = [UserRole.COMPANY_ADMIN, UserRole.PROCUREMENT_OFFICER];

// Material catalogue is owned by the super-admin (public catalogue + approvals)
// and also visible to buyer roles (US 4.01).
const CATALOGUE_VIEWERS: readonly UserRole[] = [UserRole.SUPER_ADMIN, ...BUYER_SIDE];

const RFQ_VIEWERS: readonly UserRole[] = [...BUYER_SIDE, UserRole.VENDOR];
const PO_VIEWERS = RFQ_VIEWERS;
const BULK_VIEWERS = RFQ_VIEWERS;
const INVOICE_VIEWERS: readonly UserRole[] = [
  ...BUYER_SIDE,
  UserRole.FINANCIAL_OFFICER,
  UserRole.VENDOR,
];

export function getSidebarItemsForRole(
  role: UserRole | null,
  pathname: string,
  labels: Record<string, string>,
): SidebarNavItem[] {
  if (!role) return [];

  const items: RoleAwareSidebarItem[] = [
    {
      icon: <ProjectsIcon className="w-5 h-5" />,
      label: labels.projects,
      href: ROUTES.projects,
      roles: BUYER_SIDE,
    },
    {
      icon: <RequestIcon className="w-5 h-5" />,
      label: labels.rfqs,
      href: ROUTES.rfqs,
      roles: RFQ_VIEWERS,
    },
    {
      icon: <PurchaseOrdersIcon className="w-5 h-5" />,
      label: labels.purchaseOrders,
      href: ROUTES.purchaseOrders,
      roles: PO_VIEWERS,
    },
    {
      icon: <BulkOrdersIcon className="w-5 h-5" />,
      label: labels.bulkOrders,
      href: ROUTES.bulkOrders,
      roles: BULK_VIEWERS,
    },
    {
      icon: <InvoiceIcon className="w-5 h-5" />,
      label: labels.invoices,
      href: ROUTES.invoices,
      roles: INVOICE_VIEWERS,
    },
    {
      icon: <VendorsIcon className="w-5 h-5" />,
      label: labels.vendors,
      href: ROUTES.vendors,
      roles: BUYER_SIDE,
    },
    {
      icon: <MaterialCatalogueIcon className="w-5 h-5" />,
      label: labels.materialCatalogue,
      href: ROUTES.materialCatalogue,
      roles: CATALOGUE_VIEWERS,
    },
    {
      icon: <SettingsIcon className="w-5 h-5" />,
      label: labels.settings,
      href: ROUTES.settings,
      roles: [...ALL_INTERNAL, UserRole.VENDOR],
      hasSubmenu: true,
      matchPathname: (p) => p === ROUTES.settings || p.startsWith(ROUTES.settings + '/'),
    },
  ];

  return items
    .filter((item) => item.roles.includes(role))
    .map(({ matchPathname, roles: _roles, ...rest }) => ({
      ...rest,
      isActive: matchPathname ? matchPathname(pathname) : pathname.startsWith(rest.href),
    }));
}
