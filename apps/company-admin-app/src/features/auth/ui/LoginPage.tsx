import { LoginPage as SharedLoginPage } from '@forethread/ui-components';

import { useLogin } from '../services/auth.service';

export default function LoginPage() {
  const loginMutation = useLogin();

  return <SharedLoginPage loginMutation={loginMutation} />;
}
