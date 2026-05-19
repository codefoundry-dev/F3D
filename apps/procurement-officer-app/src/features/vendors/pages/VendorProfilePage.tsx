import { VendorProfilePage as SharedVendorProfilePage } from '@forethread/vendor-shared';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

export default function VendorProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  if (!id) return null;

  return (
    <SharedVendorProfilePage
      vendorId={id}
      onBack={() => navigate(-1)}
      initialEdit={searchParams.get('edit') === 'true'}
    />
  );
}
