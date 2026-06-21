import { useTranslation } from '@forethread/i18n';
import { CompanyType } from '@forethread/shared-types/client';
import { Modal, ModalBody, ModalIconHeader } from '@forethread/ui-components';
import BriefcaseIcon from '@forethread/ui-components/assets/icons/briefcase.svg?react';
import ChevronRightIcon from '@forethread/ui-components/assets/icons/chevron-right.svg?react';
import DepartmentIcon from '@forethread/ui-components/assets/icons/department.svg?react';
import SuppliersIcon from '@forethread/ui-components/assets/icons/suppliers.svg?react';
import type { ReactNode } from 'react';

interface CreateCompanyChooserModalProps {
  onClose: () => void;
  onSelect: (type: CompanyType) => void;
}

/**
 * Step-0 chooser for "Create company": the Super-Admin first picks whether the
 * new company is a Contractor or a Vendor, then the matching Add-company modal
 * opens. Replaces the old behaviour of jumping straight into the contractor modal.
 */
export function CreateCompanyChooserModal({ onClose, onSelect }: CreateCompanyChooserModalProps) {
  const { t } = useTranslation(['users', 'common']);

  const options: {
    type: CompanyType;
    icon: ReactNode;
    iconColor: string;
    label: string;
    hint: string;
  }[] = [
    {
      type: CompanyType.CONTRACTOR,
      icon: <BriefcaseIcon className="size-5" />,
      iconColor: 'text-blue-600',
      label: t('createCompanyChooser.contractor'),
      hint: t('createCompanyChooser.contractorHint'),
    },
    {
      type: CompanyType.VENDOR,
      icon: <SuppliersIcon className="size-5" />,
      iconColor: 'text-pink-600',
      label: t('createCompanyChooser.vendor'),
      hint: t('createCompanyChooser.vendorHint'),
    },
  ];

  return (
    <Modal onClose={onClose} maxWidth="max-w-[480px]">
      <ModalBody>
        <ModalIconHeader
          icon={<DepartmentIcon className="size-6 text-gray-700" />}
          title={t('createCompanyChooser.title')}
          subtitle={t('createCompanyChooser.subtitle')}
          onClose={onClose}
        />

        <div className="mt-6 flex flex-col gap-3">
          {options.map((o) => (
            <button
              key={o.type}
              type="button"
              onClick={() => onSelect(o.type)}
              className="group flex items-center gap-3 rounded-[12px] border border-gray-100 bg-white p-3 text-left shadow-[0_1px_3px_0_rgba(10,13,18,0.06),0_1px_1px_0_rgba(10,13,18,0.02)] transition-colors hover:border-gray-200 hover:bg-gray-25"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-[#E8EAED] bg-gradient-to-b from-[#F9F9FA] to-white shadow-[0_1px_3px_0_rgba(10,13,18,0.06),0_1px_1px_0_rgba(10,13,18,0.02)]">
                <span className={o.iconColor}>{o.icon}</span>
              </span>
              <span className="flex-1">
                <span className="block text-sm font-semibold text-gray-900">{o.label}</span>
                <span className="block text-xs text-gray-500">{o.hint}</span>
              </span>
              <ChevronRightIcon className="size-4 shrink-0 text-gray-400" />
            </button>
          ))}
        </div>
      </ModalBody>
    </Modal>
  );
}
