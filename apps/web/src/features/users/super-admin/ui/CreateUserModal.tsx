import { useTranslation } from '@forethread/i18n';
import { CompanyType } from '@forethread/shared-types/client';
import {
  Modal,
  ModalGridBackground,
  REGISTRATION_MODAL_CARD_CLASS,
  UserAlreadyExistsModal,
} from '@forethread/ui-components';
import { useState } from 'react';

import { AddContractorCompanyModal } from './modals/AddContractorCompanyModal';
import { AddVendorCompanyModal } from './modals/AddVendorCompanyModal';
import { CompanySelectionStep } from './steps/CompanySelectionStep';
import { InvitationSuccessStep } from './steps/InvitationSuccessStep';
import { UserDetailsStep } from './steps/UserDetailsStep';

type Step = 'companySelection' | 'userDetails' | 'success';

interface PreselectedCompany {
  id: string;
  name: string;
  type: CompanyType;
}

interface CreateUserModalProps {
  onClose: () => void;
  preselectedCompany?: PreselectedCompany;
}

export function CreateUserModal({ onClose, preselectedCompany }: CreateUserModalProps) {
  const { t } = useTranslation(['common']);
  const [step, setStep] = useState<Step>(preselectedCompany ? 'userDetails' : 'companySelection');
  const [isUserExistsOpen, setIsUserExistsOpen] = useState(false);
  const [companyType, setCompanyType] = useState<CompanyType | null>(
    preselectedCompany?.type ?? null,
  );
  const [companyId, setCompanyId] = useState<string | null>(preselectedCompany?.id ?? null);
  const [companyName, setCompanyName] = useState<string | null>(preselectedCompany?.name ?? null);
  const [createdUserEmail, setCreatedUserEmail] = useState('');
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [isNewlyCreatedCompany, setIsNewlyCreatedCompany] = useState(false);

  const handleCompanyTypeChange = (type: CompanyType) => {
    setCompanyType(type);
    setCompanyId(null);
    setCompanyName(null);
    setIsNewlyCreatedCompany(false);
  };

  const handleCompanyChange = (id: string, name: string) => {
    setCompanyId(id);
    setCompanyName(name);
  };

  const handleInvitationSuccess = (email: string) => {
    setCreatedUserEmail(email);
    setStep('success');
  };

  return (
    <>
      <Modal
        onClose={onClose}
        decoration={<ModalGridBackground />}
        cardClassName={REGISTRATION_MODAL_CARD_CLASS}
      >
        {step === 'companySelection' && (
          <CompanySelectionStep
            companyType={companyType}
            companyId={companyId}
            onCompanyTypeChange={handleCompanyTypeChange}
            onCompanyChange={handleCompanyChange}
            onContinue={() => setStep('userDetails')}
            onCancel={onClose}
            onAddCompany={() => setShowAddCompanyModal(true)}
          />
        )}

        {step === 'userDetails' && companyType && companyId && companyName && (
          <UserDetailsStep
            companyType={companyType}
            companyId={companyId}
            companyName={companyName}
            isNewlyCreatedCompany={isNewlyCreatedCompany}
            onSuccess={handleInvitationSuccess}
            onCancel={onClose}
            onUserExists={() => setIsUserExistsOpen(true)}
          />
        )}

        {step === 'success' && <InvitationSuccessStep email={createdUserEmail} onClose={onClose} />}
      </Modal>

      {isUserExistsOpen && (
        <UserAlreadyExistsModal
          onClose={() => setIsUserExistsOpen(false)}
          onBack={onClose}
          title={t('common:userAlreadyExists.title')}
          description={t('common:userAlreadyExists.description')}
          buttonLabel={t('common:userAlreadyExists.backButton')}
        />
      )}

      {showAddCompanyModal && companyType === CompanyType.CONTRACTOR && (
        <AddContractorCompanyModal
          onClose={() => setShowAddCompanyModal(false)}
          onSuccess={(company) => {
            setCompanyId(company.id);
            setCompanyName(company.legalName);
            setIsNewlyCreatedCompany(true);
          }}
        />
      )}
      {showAddCompanyModal && companyType === CompanyType.VENDOR && (
        <AddVendorCompanyModal
          onClose={() => setShowAddCompanyModal(false)}
          onSuccess={(company) => {
            setCompanyId(company.id);
            setCompanyName(company.legalName);
            setIsNewlyCreatedCompany(true);
          }}
        />
      )}
    </>
  );
}
