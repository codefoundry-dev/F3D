import { ForgotPasswordPage as SharedForgotPasswordPage } from '@forethread/ui-components';

import { useForgotPassword } from '../services/auth.service';

export default function ForgotPasswordPage() {
  const forgotMutation = useForgotPassword();

  return <SharedForgotPasswordPage forgotMutation={forgotMutation} />;
}
