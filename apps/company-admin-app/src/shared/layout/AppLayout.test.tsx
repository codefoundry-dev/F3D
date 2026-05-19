import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
  AvatarWithStatus: ({ name, avatarUrl, workStatus, size }: any) => (
    <div
      data-testid="avatar-with-status"
      data-name={name}
      data-avatar={avatarUrl}
      data-status={workStatus}
      data-size={size}
    />
  ),
  NotificationBell: (props: any) => <div data-testid="notification-bell" {...props} />,
  PageHeader: ({ title, subtitle, onBack }: any) => (
    <div data-testid="page-header">
      {title} {subtitle}
      {onBack && (
        <button data-testid="page-header-back" onClick={onBack}>
          Back
        </button>
      )}
    </div>
  ),
  SearchInput: (props: any) => <input data-testid="search-input" {...props} />,
  Sidebar: ({ items, onNavigate, onLogoClick }: any) => (
    <div data-testid="sidebar">
      {items?.map((item: any) => (
        <button
          key={item.label}
          data-testid={`nav-${item.label}`}
          onClick={() => onNavigate(item.href)}
        >
          {item.label}
        </button>
      ))}
      <button data-testid="logo" onClick={onLogoClick}>
        Logo
      </button>
    </div>
  ),
}));

// Mock all SVG icons
vi.mock('@forethread/ui-components/assets/icons/bulk-orders.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/invoice.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/logo.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/material-catalogue.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/projects.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/purchase-orders.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/request.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/settings.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/vendors.svg?react', () => ({
  default: () => <div />,
}));

vi.mock('@forethread/rfq-shared', () => ({
  usePageTitleStore: (selector: (s: { title: string | null }) => unknown) =>
    selector({ title: 'Dynamic Title' }),
}));

vi.mock('@/app/route-config', () => ({
  ROUTES: {
    home: '/',
    rfqs: '/rfqs',
    rfqNew: '/rfqs/new',
    rfqDetail: '/rfqs/:id',
    quoteResponseDetail: '/rfqs/:id/quotes/:quoteId',
    purchaseOrders: '/purchase-orders',
    purchaseOrderNew: '/purchase-orders/new',
    purchaseOrderDetail: '/purchase-orders/:id',
    projects: '/projects',
    projectsNew: '/projects/new',
    projectDetail: '/projects/:id',
    projectEdit: '/projects/:id/edit',
    bulkOrders: '/bulk-orders',
    bulkOrderDetail: '/bulk-orders/:id',
    invoices: '/invoices',
    invoiceDetail: '/invoices/:id',
    invoiceUpload: '/invoices/upload',
    vendors: '/vendors',
    vendorNew: '/vendors/new',
    materialCatalogue: '/material-catalogue',
    settings: '/settings',
    users: '/settings/users',
    userDetail: '/settings/users/:id',
    profile: '/settings/profile',
    companyProfile: '/settings/company',
  },
}));

const mockNavigate = vi.fn();
const mockPathname = vi.hoisted(() => ({ value: '/' }));
vi.mock('react-router-dom', () => ({
  Outlet: () => <div data-testid="outlet" />,
  useLocation: () => ({ pathname: mockPathname.value }),
  useNavigate: () => mockNavigate,
}));

const mockLogoutMutate = vi.fn();
vi.mock('@/features/auth/services/auth.service', () => ({
  useLogout: () => ({ mutate: mockLogoutMutate, isPending: false }),
}));

vi.mock('@/features/auth/state/auth.store', () => ({
  useAuthStore: (selector: (s: any) => any) =>
    selector({ currentUser: { name: 'John', companyId: 'c1' } }),
}));

vi.mock('@/features/profile/services/profile.service', () => ({
  useAvatarUrl: () => ({ data: null }),
  useProfile: () => ({ data: { workStatus: 'available' } }),
}));

import { AppLayout } from './AppLayout';

describe('AppLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.value = '/';
  });

  it('renders sidebar', () => {
    render(<AppLayout />);
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
  });

  it('renders page header', () => {
    render(<AppLayout />);
    expect(screen.getByTestId('page-header')).toBeInTheDocument();
  });

  it('renders outlet', () => {
    render(<AppLayout />);
    expect(screen.getByTestId('outlet')).toBeInTheDocument();
  });

  it('renders notification bell', () => {
    render(<AppLayout />);
    expect(screen.getByTestId('notification-bell')).toBeInTheDocument();
  });

  it('renders avatar with status component', () => {
    render(<AppLayout />);
    const avatar = screen.getByTestId('avatar-with-status');
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveAttribute('data-name', 'John');
    expect(avatar).toHaveAttribute('data-status', 'available');
  });

  it('renders My Profile button', () => {
    render(<AppLayout />);
    expect(screen.getByText('auth:myProfile')).toBeInTheDocument();
  });

  it('renders Logout button', () => {
    render(<AppLayout />);
    expect(screen.getByText('auth:logout')).toBeInTheDocument();
  });

  it('logo click navigates to home', () => {
    render(<AppLayout />);
    fireEvent.click(screen.getByTestId('logo'));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('navigates to rfqs when rfqs nav item is clicked', () => {
    render(<AppLayout />);
    fireEvent.click(screen.getByTestId('nav-nav:rfqs'));
    expect(mockNavigate).toHaveBeenCalledWith('/rfqs');
  });

  it('navigates to projects when projects nav item is clicked', () => {
    render(<AppLayout />);
    fireEvent.click(screen.getByTestId('nav-nav:projects'));
    expect(mockNavigate).toHaveBeenCalledWith('/projects');
  });

  it('navigates to settings when settings nav item is clicked', () => {
    render(<AppLayout />);
    fireEvent.click(screen.getByTestId('nav-nav:companySettings'));
    expect(mockNavigate).toHaveBeenCalledWith('/settings');
  });

  it('navigates to purchase orders when purchase orders nav item is clicked', () => {
    render(<AppLayout />);
    fireEvent.click(screen.getByTestId('nav-nav:purchaseOrders'));
    expect(mockNavigate).toHaveBeenCalledWith('/purchase-orders');
  });

  it('navigates to invoices when invoices nav item is clicked', () => {
    render(<AppLayout />);
    fireEvent.click(screen.getByTestId('nav-nav:invoices'));
    expect(mockNavigate).toHaveBeenCalledWith('/invoices');
  });

  it('navigates to vendors when vendors nav item is clicked', () => {
    render(<AppLayout />);
    fireEvent.click(screen.getByTestId('nav-nav:vendors'));
    expect(mockNavigate).toHaveBeenCalledWith('/vendors');
  });

  it('navigates to profile when My Profile button is clicked', () => {
    render(<AppLayout />);
    fireEvent.click(screen.getByText('auth:myProfile'));
    expect(mockNavigate).toHaveBeenCalledWith('/settings/profile');
  });

  it('calls logout mutate when Logout button is clicked', () => {
    render(<AppLayout />);
    fireEvent.click(screen.getByText('auth:logout'));
    expect(mockLogoutMutate).toHaveBeenCalled();
  });

  it('navigates to bulk orders when bulk orders nav item is clicked', () => {
    render(<AppLayout />);
    fireEvent.click(screen.getByTestId('nav-nav:bulkOrders'));
    expect(mockNavigate).toHaveBeenCalledWith('/bulk-orders');
  });

  it('navigates to material catalogue when material catalogue nav item is clicked', () => {
    render(<AppLayout />);
    fireEvent.click(screen.getByTestId('nav-nav:materialCatalogue'));
    expect(mockNavigate).toHaveBeenCalledWith('/material-catalogue');
  });

  it('shows profile page title and onBack navigates to settings', () => {
    mockPathname.value = '/settings/profile';
    render(<AppLayout />);
    expect(screen.getByTestId('page-header')).toHaveTextContent('myProfile');
    fireEvent.click(screen.getByTestId('page-header-back'));
    expect(mockNavigate).toHaveBeenCalledWith('/settings');
  });

  it('shows company profile page title and onBack navigates to settings', () => {
    mockPathname.value = '/settings/company';
    render(<AppLayout />);
    expect(screen.getByTestId('page-header')).toHaveTextContent('companyProfile');
    fireEvent.click(screen.getByTestId('page-header-back'));
    expect(mockNavigate).toHaveBeenCalledWith('/settings');
  });

  it('shows users page title and onBack navigates to settings', () => {
    mockPathname.value = '/settings/users';
    render(<AppLayout />);
    expect(screen.getByTestId('page-header')).toHaveTextContent('userManagement');
    fireEvent.click(screen.getByTestId('page-header-back'));
    expect(mockNavigate).toHaveBeenCalledWith('/settings');
  });

  it('shows user profile title and onBack navigates to users for user detail route', () => {
    mockPathname.value = '/settings/users/u1';
    render(<AppLayout />);
    expect(screen.getByTestId('page-header')).toHaveTextContent('userProfile');
    fireEvent.click(screen.getByTestId('page-header-back'));
    expect(mockNavigate).toHaveBeenCalledWith('/settings/users');
  });

  it('shows project detail title and onBack navigates to projects', () => {
    mockPathname.value = '/projects/proj-1';
    render(<AppLayout />);
    expect(screen.getByTestId('page-header')).toHaveTextContent('projects');
    fireEvent.click(screen.getByTestId('page-header-back'));
    expect(mockNavigate).toHaveBeenCalledWith('/projects');
  });

  it('shows rfq detail title and onBack navigates to rfqs', () => {
    mockPathname.value = '/rfqs/rfq-1';
    render(<AppLayout />);
    fireEvent.click(screen.getByTestId('page-header-back'));
    expect(mockNavigate).toHaveBeenCalledWith('/rfqs');
  });

  it('shows quote detail title and onBack navigates to rfq with responses tab', () => {
    mockPathname.value = '/rfqs/rfq-1/quotes/q-1';
    render(<AppLayout />);
    fireEvent.click(screen.getByTestId('page-header-back'));
    expect(mockNavigate).toHaveBeenCalledWith('/rfqs/rfq-1?tab=responses');
  });

  it('shows create rfq title and onBack navigates to rfqs', () => {
    mockPathname.value = '/rfqs/new';
    render(<AppLayout />);
    fireEvent.click(screen.getByTestId('page-header-back'));
    expect(mockNavigate).toHaveBeenCalledWith('/rfqs');
  });

  it('shows purchase order detail and onBack navigates to POs', () => {
    mockPathname.value = '/purchase-orders/po-1';
    render(<AppLayout />);
    fireEvent.click(screen.getByTestId('page-header-back'));
    expect(mockNavigate).toHaveBeenCalledWith('/purchase-orders');
  });

  it('shows create PO title and onBack navigates to POs', () => {
    mockPathname.value = '/purchase-orders/new';
    render(<AppLayout />);
    fireEvent.click(screen.getByTestId('page-header-back'));
    expect(mockNavigate).toHaveBeenCalledWith('/purchase-orders');
  });

  it('shows invoice detail and onBack navigates to invoices', () => {
    mockPathname.value = '/invoices/inv-1';
    render(<AppLayout />);
    fireEvent.click(screen.getByTestId('page-header-back'));
    expect(mockNavigate).toHaveBeenCalledWith('/invoices');
  });

  it('shows upload invoice title and onBack navigates to invoices', () => {
    mockPathname.value = '/invoices/upload';
    render(<AppLayout />);
    fireEvent.click(screen.getByTestId('page-header-back'));
    expect(mockNavigate).toHaveBeenCalledWith('/invoices');
  });

  it('shows add vendor title and onBack navigates to vendors', () => {
    mockPathname.value = '/vendors/new';
    render(<AppLayout />);
    fireEvent.click(screen.getByTestId('page-header-back'));
    expect(mockNavigate).toHaveBeenCalledWith('/vendors');
  });

  it('shows bulk order detail and onBack navigates to bulk orders', () => {
    mockPathname.value = '/bulk-orders/bo-1';
    render(<AppLayout />);
    fireEvent.click(screen.getByTestId('page-header-back'));
    expect(mockNavigate).toHaveBeenCalledWith('/bulk-orders');
  });

  it('shows rfqs page title with back to home', () => {
    mockPathname.value = '/rfqs';
    render(<AppLayout />);
    expect(screen.getByTestId('page-header')).toHaveTextContent('rfqs');
    fireEvent.click(screen.getByTestId('page-header-back'));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('shows PO comms page and onBack navigates to PO detail with tab', () => {
    mockPathname.value = '/purchase-orders/po-1/comms';
    render(<AppLayout />);
    fireEvent.click(screen.getByTestId('page-header-back'));
    expect(mockNavigate).toHaveBeenCalledWith('/purchase-orders/po-1?tab=purchaseOrders');
  });

  it('shows purchase orders list title with back to home', () => {
    mockPathname.value = '/purchase-orders';
    render(<AppLayout />);
    expect(screen.getByTestId('page-header')).toHaveTextContent('purchaseOrders');
    fireEvent.click(screen.getByTestId('page-header-back'));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('shows projects list title with back to home', () => {
    mockPathname.value = '/projects';
    render(<AppLayout />);
    expect(screen.getByTestId('page-header')).toHaveTextContent('projects');
    fireEvent.click(screen.getByTestId('page-header-back'));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('shows bulk orders list title with back to home', () => {
    mockPathname.value = '/bulk-orders';
    render(<AppLayout />);
    expect(screen.getByTestId('page-header')).toHaveTextContent('bulkOrders');
    fireEvent.click(screen.getByTestId('page-header-back'));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('shows invoices list title with back to home', () => {
    mockPathname.value = '/invoices';
    render(<AppLayout />);
    expect(screen.getByTestId('page-header')).toHaveTextContent('invoices');
    fireEvent.click(screen.getByTestId('page-header-back'));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('shows vendors list title with back to home', () => {
    mockPathname.value = '/vendors';
    render(<AppLayout />);
    expect(screen.getByTestId('page-header')).toHaveTextContent('vendors');
    fireEvent.click(screen.getByTestId('page-header-back'));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('shows material catalogue title with back to home', () => {
    mockPathname.value = '/material-catalogue';
    render(<AppLayout />);
    expect(screen.getByTestId('page-header')).toHaveTextContent('materialCatalogue');
    fireEvent.click(screen.getByTestId('page-header-back'));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('shows settings page without back button', () => {
    mockPathname.value = '/settings';
    render(<AppLayout />);
    expect(screen.getByTestId('page-header')).toHaveTextContent('settings');
    expect(screen.queryByTestId('page-header-back')).not.toBeInTheDocument();
  });

  it('shows dashboard page without back button', () => {
    mockPathname.value = '/';
    render(<AppLayout />);
    expect(screen.getByTestId('page-header')).toHaveTextContent('dashboard');
    expect(screen.queryByTestId('page-header-back')).not.toBeInTheDocument();
  });
});
