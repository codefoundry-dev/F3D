import { VendorProfilePage } from '@forethread/vendor-shared';
import { useNavigate } from 'react-router-dom';

import { useAuthStore } from '@/features/auth/state/auth.store';

export default function CompanyProfilePage() {
  const companyId = useAuthStore((s) => s.currentUser?.companyId);
  const navigate = useNavigate();

  if (!companyId) return null;

  return <VendorProfilePage vendorId={companyId} onBack={() => navigate(-1)} />;
}
