// UI Components barrel export

// Hooks
export { useDebounce } from './hooks/useDebounce';
export { useClickOutside } from './hooks/useClickOutside';
export { useEscapeKey } from './hooks/useEscapeKey';
export { useMediaQuery } from './hooks/useMediaQuery';

// Utilities
export { cn } from './utils/cn';
export { onDigitsOnly, onDecimalOnly, onPhoneOnly } from './utils/inputFilters';
export { formatDateTime } from './utils/formatDateTime';
export { formatCurrency, formatDate, formatEnum, formatStatus } from './utils/formatters';
export { formatTime, formatDateLabel, groupMessagesByDate } from './utils/messaging';
export type { MessageItem } from './utils/messaging';
export {
  DEFAULT_STATUS_COLOR,
  NEUTRAL_STATUS_COLOR,
  RFQ_STATUS_COLORS,
  VENDOR_RFQ_STATUS_COLORS,
  PO_STATUS_COLORS,
  DELIVERY_STATUS_COLORS,
  BULK_ORDER_STATUS_COLORS,
  INVOICE_STATUS_COLORS,
  ORDER_STATUS_COLORS,
  CHANGE_REQUEST_STATUS_COLORS,
  getStatusColor,
} from './utils/status-colors';

// Components
export { Button, buttonVariants } from './components/Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './components/Button';

export { Input } from './components/Input';
export type { InputProps, InputSize } from './components/Input';

export { StepperInput } from './components/StepperInput';
export type { StepperInputProps } from './components/StepperInput';

export { AddressInput } from './components/AddressInput';
export type { AddressInputProps } from './components/AddressInput';

export { Textarea } from './components/Textarea';
export type { TextareaProps } from './components/Textarea';

export { Select } from './components/Select';
export type { SelectProps } from './components/Select';

export { FormField } from './components/FormField';
export type { FormFieldProps } from './components/FormField';

export { Alert } from './components/Alert';
export type { AlertProps } from './components/Alert';

export { Spinner, PageLoader } from './components/Spinner';
export type { SpinnerProps } from './components/Spinner';

export { Badge } from './components/Badge';
export type { BadgeProps, BadgeColor, BadgeSize } from './components/Badge';

export {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  ModalIconHeader,
  ModalGridBackground,
  ModalGridHeader,
  REGISTRATION_MODAL_CARD_CLASS,
} from './components/Modal';
export type { ModalProps, ModalIconHeaderProps, ModalGridHeaderProps } from './components/Modal';

export { GridModal } from './components/GridModal';
export type { GridModalProps, GridModalSize } from './components/GridModal';

export { ConfirmDialog } from './components/ConfirmDialog';
export type { ConfirmDialogProps } from './components/ConfirmDialog';

export { StatusActionModal } from './components/StatusActionModal';
export type { StatusActionModalProps } from './components/StatusActionModal';

export { StatusSuccessModal } from './components/StatusSuccessModal';
export type { StatusSuccessModalProps } from './components/StatusSuccessModal';

export { StatusErrorModal } from './components/StatusErrorModal';
export type { StatusErrorModalProps } from './components/StatusErrorModal';

export { UserAlreadyExistsModal } from './components/UserAlreadyExistsModal';
export type { UserAlreadyExistsModalProps } from './components/UserAlreadyExistsModal';

export { CopyEntityModal } from './components/CopyEntityModal';
export type { CopyEntityModalProps } from './components/CopyEntityModal';

export { ResetPasswordSuccessModal } from './components/ResetPasswordSuccessModal';
export type { ResetPasswordSuccessModalProps } from './components/ResetPasswordSuccessModal';

export { Pagination } from './components/Pagination';
export type { PaginationProps } from './components/Pagination';

export { TablePagination } from './components/TablePagination';
export type { TablePaginationProps } from './components/TablePagination';

export { EmptyState } from './components/EmptyState';
export type { EmptyStateProps } from './components/EmptyState';

export { EmptyBoxIllustration } from './components/EmptyBoxIllustration';
export type { EmptyBoxIllustrationProps } from './components/EmptyBoxIllustration';

export { SearchEmptyIllustration } from './components/SearchEmptyIllustration';
export type { SearchEmptyIllustrationProps } from './components/SearchEmptyIllustration';

export { QueryContainer } from './components/QueryContainer';
export type { QueryContainerProps } from './components/QueryContainer';

export { ItemMeta } from './components/ItemMeta';
export type { ItemMetaProps } from './components/ItemMeta';

export { PasswordInput } from './components/PasswordInput';
export type { PasswordInputProps } from './components/PasswordInput';

export { Text } from './components/Text';
export type { TextProps, TextVariant } from './components/Text';

export { IconBadge } from './components/IconBadge';
export type { IconBadgeProps, IconBadgeColor, IconBadgeSize } from './components/IconBadge';

export { Card } from './components/Card';
export type { CardProps } from './components/Card';

export { Divider } from './components/Divider';
export type { DividerProps } from './components/Divider';

export { DocumentBrandHeader } from './components/DocumentBrandHeader';
export type { DocumentBrandHeaderProps } from './components/DocumentBrandHeader';

export { StepCircle } from './components/StepCircle';
export type { StepCircleProps } from './components/StepCircle';

export { MaterialSearchPanel } from './components/MaterialSearchPanel';
export type {
  MaterialSearchPanelProps,
  MaterialItem,
  SelectedMaterial,
  MaterialFilters,
  MaterialFilterOption,
} from './components/MaterialSearchPanel';

export { LoginForm } from './components/LoginForm';
export type { LoginFormProps } from './components/LoginForm';

export { ForgotPasswordForm } from './components/ForgotPasswordForm';
export type { ForgotPasswordFormProps } from './components/ForgotPasswordForm';

export { CheckEmailCard } from './components/CheckEmailCard';
export type { CheckEmailCardProps } from './components/CheckEmailCard';

export { TwoFactorCard } from './components/TwoFactorCard';
export type { TwoFactorCardProps } from './components/TwoFactorCard';

export { ResetPasswordForm } from './components/ResetPasswordForm';
export type { ResetPasswordFormProps, PasswordRule } from './components/ResetPasswordForm';

export { AuthLayout } from './components/AuthLayout';
export type { AuthLayoutProps } from './components/AuthLayout';
export { AuthBackground } from './components/AuthBackground';
export { AuthPageLoader } from './components/AuthPageLoader';

export { ThemeProvider, useTheme } from './components/ThemeProvider';
export type { Theme, ThemeProviderProps } from './components/ThemeProvider';

export { Sidebar } from './components/Sidebar';
export type { SidebarProps, SidebarNavItem } from './components/Sidebar';

export { PageHeader } from './components/PageHeader';
export type { PageHeaderProps } from './components/PageHeader';

// Toast notifications (sonner)
export { Toaster, toast } from 'sonner';

export { CustomToast, notificationService } from './components/CustomToast';
export type { CustomToastProps, ToastType } from './components/CustomToast';

export { DotActionsMenu } from './components/DotActionsMenu';
export type { DotActionsMenuProps, DotAction } from './components/DotActionsMenu';

export { CustomDropdown } from './components/CustomDropdown';
export type {
  CustomDropdownProps,
  DropdownOption,
  DropdownActionItem,
} from './components/CustomDropdown';

export { ErrorFallback } from './components/ErrorFallback';
export type { ErrorFallbackProps } from './components/ErrorFallback';

export { Checkbox } from './components/Checkbox';
export type { CheckboxProps } from './components/Checkbox';

export { RadioButton } from './components/RadioButton';
export type { RadioButtonProps } from './components/RadioButton';

export { RadioGroup } from './components/RadioGroup';
export type { RadioGroupProps, RadioGroupOption } from './components/RadioGroup';

export { FilterChip } from './components/FilterChip';
export type { FilterChipProps } from './components/FilterChip';

export { FilterTag } from './components/FilterTag';
export type { FilterTagProps } from './components/FilterTag';

export { FilterPopover } from './components/FilterPopover';
export type { FilterPopoverProps, FilterOption } from './components/FilterPopover';

export { FilterDropdownButton } from './components/FilterDropdownButton';
export type {
  FilterDropdownButtonProps,
  FilterDropdownOption,
} from './components/FilterDropdownButton';

export { DateRangeFilterDropdown } from './components/DateRangeFilterDropdown';
export type { DateRangeFilterDropdownProps } from './components/DateRangeFilterDropdown';

export { SortIcon } from './components/SortIcon';
export type { SortIconProps, SortDirection } from './components/SortIcon';

export {
  TABLE_CONTAINER,
  TABLE_HEADER_ROW,
  TABLE_HEADER_CELL,
  TABLE_ROW,
  TABLE_ROW_SELECTED,
  TABLE_CELL,
  TABLE_CELL_CAPTION,
} from './components/tableStyles';

export { SearchInput } from './components/SearchInput';
export type { SearchInputProps } from './components/SearchInput';

export { NotificationBell } from './components/NotificationBell';
export type { NotificationBellProps } from './components/NotificationBell';

export { AvatarUpload } from './components/AvatarUpload';
export type { AvatarUploadProps } from './components/AvatarUpload';

export { AvatarWithStatus } from './components/AvatarWithStatus';
export type { AvatarWithStatusProps, WorkStatusType } from './components/AvatarWithStatus';

export { AvatarStack } from './components/AvatarStack';
export type { AvatarStackProps, AvatarStackPerson } from './components/AvatarStack';

export { ContactSupportLink } from './components/ContactSupportLink';
export type { ContactSupportLinkProps } from './components/ContactSupportLink';

export { DataTable } from './components/DataTable';
export type { DataTableProps, ColumnDef } from './components/DataTable';

export { DataTablePagination } from './components/DataTable';
export type { DataTablePaginationProps } from './components/DataTable';

export { DataTableSearch } from './components/DataTable';
export type { DataTableSearchProps } from './components/DataTable';

export { DataTableQuickFilters } from './components/DataTable';
export type { DataTableQuickFiltersProps, QuickFilterOption } from './components/DataTable';

export { DataTableBulkActions } from './components/DataTable';
export type { DataTableBulkActionsProps, BulkAction } from './components/DataTable';

export { DataTableActions } from './components/DataTable';
export type { DataTableActionsProps, RowAction } from './components/DataTable';

export { DashboardSection, DashboardSectionSkeleton } from './components/DashboardSection';
export type { DashboardSectionProps } from './components/DashboardSection';

export { DashboardItemCard } from './components/DashboardItemCard';
export type { DashboardItemCardProps, MetadataField } from './components/DashboardItemCard';

export { InvoiceCard } from './components/InvoiceCard';
export type { InvoiceCardProps, InvoiceCardItem } from './components/InvoiceCard';

export { ChangePasswordModal } from './components/ChangePasswordModal';
export type {
  ChangePasswordModalProps,
  ChangePasswordModalLabels,
} from './components/ChangePasswordModal';
export type { PasswordRule as ChangePasswordRule } from './components/ChangePasswordModal';

export { TableManagementModal } from './components/TableManagementModal';
export type {
  TableManagementModalProps,
  TableColumn,
  SavedView,
} from './components/TableManagementModal';

export { CreateViewModal } from './components/CreateViewModal';
export type { CreateViewModalProps } from './components/CreateViewModal';

export { MessageBadgeIcon } from './components/MessageBadgeIcon';
export type { MessageBadgeIconProps } from './components/MessageBadgeIcon';

export { InfoHint } from './components/InfoHint';
export type { InfoHintProps } from './components/InfoHint';

export { Tooltip } from './components/Tooltip';
export type { TooltipProps, TooltipSide } from './components/Tooltip';

export { Tabs } from './components/Tabs';
export type { TabsProps, TabItem } from './components/Tabs';

export { SegmentedControl } from './components/SegmentedControl';
export type { SegmentedControlProps, SegmentedControlItem } from './components/SegmentedControl';

export { Breadcrumbs } from './components/Breadcrumbs';
export type { BreadcrumbsProps, BreadcrumbItem } from './components/Breadcrumbs';

export { DatePicker } from './components/DatePicker';
export type { DatePickerProps } from './components/DatePicker';

export { FilterPanel } from './components/FilterPanel';
export type { FilterPanelProps } from './components/FilterPanel';

export { FiltersButton } from './components/FiltersButton';
export type { FiltersButtonProps } from './components/FiltersButton';

export { ModalFilterPanel } from './components/ModalFilterPanel';
export type { ModalFilterPanelProps } from './components/ModalFilterPanel';

export { SelectionBar } from './components/SelectionBar';
export type { SelectionBarProps } from './components/SelectionBar';

export { SelectDropdown } from './components/SelectDropdown';
export type { SelectDropdownProps, SelectOption } from './components/SelectDropdown';

// Toolbar components
export { ToolbarIconButton } from './components/ToolbarIconButton';
export type { ToolbarIconButtonProps } from './components/ToolbarIconButton';

export { GroupByButton } from './components/GroupByButton';
export type { GroupByButtonProps } from './components/GroupByButton';

export { ExportDropdownButton } from './components/ExportDropdownButton';
export type { ExportDropdownButtonProps, ExportFormat } from './components/ExportDropdownButton';

export { ViewSelectorDropdown } from './components/ViewSelectorDropdown';
export type { ViewSelectorDropdownProps } from './components/ViewSelectorDropdown';

export { ToolbarSearchToggle } from './components/ToolbarSearchToggle';
export type { ToolbarSearchToggleProps } from './components/ToolbarSearchToggle';

export { ToggleSwitch } from './components/ToggleSwitch';
export type { ToggleSwitchProps } from './components/ToggleSwitch';

export { FileDropzone } from './components/FileDropzone';
export type { FileDropzoneProps } from './components/FileDropzone';

export { FileChip } from './components/FileChip';
export type { FileChipProps } from './components/FileChip';

// Page-level shared components (auth pages)
export { LoginPage } from './components/LoginPage';
export type { LoginPageProps } from './components/LoginPage';

export { ForgotPasswordPage } from './components/ForgotPasswordPage';
export type { ForgotPasswordPageProps } from './components/ForgotPasswordPage';

export { PrivateRoute } from './components/PrivateRoute';
export type { PrivateRouteProps } from './components/PrivateRoute';

export { GuestRoute } from './components/GuestRoute';
export type { GuestRouteProps } from './components/GuestRoute';

export { ErrorPage } from './components/ErrorPage';
export type { ErrorPageProps } from './components/ErrorPage';

// Toolbar hooks
export { useDropdown } from './hooks/useDropdown';
export { useColumnResize } from './hooks/useColumnResize';
export type { UseColumnResizeOptions } from './hooks/useColumnResize';
export { useColumnDragDrop } from './hooks/useColumnDragDrop';
