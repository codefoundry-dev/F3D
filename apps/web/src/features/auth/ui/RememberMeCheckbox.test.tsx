import { LoginPage } from '@forethread/ui-components';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

// The sign-in form's "Remember me for 30 days" box decides whether this browser
// skips the emailed code for the next 30 days. It starts checked.

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function renderLogin() {
  const loginMutation = { mutate: vi.fn(), isPending: false, isError: false, error: null };
  render(
    <MemoryRouter>
      <LoginPage loginMutation={loginMutation} />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText('emailLabel'), {
    target: { value: 'buyer@test.local' },
  });
  fireEvent.change(screen.getByLabelText('passwordLabel'), {
    target: { value: 'Password123' },
  });
  return loginMutation;
}

const rememberBox = () => screen.getByRole('checkbox', { name: 'rememberDevice' });

/** Submit once the form has validated (the button stays disabled until then). */
async function submit() {
  const button = screen.getByRole('button', { name: 'signIn' });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
}

describe('LoginPage — Remember me for 30 days', () => {
  it('is checked by default and is sent with the sign-in', async () => {
    const loginMutation = renderLogin();
    expect(rememberBox()).toBeChecked();

    await submit();

    await waitFor(() =>
      expect(loginMutation.mutate).toHaveBeenCalledWith({
        email: 'buyer@test.local',
        password: 'Password123',
        rememberDevice: true,
      }),
    );
  });

  it('sends rememberDevice=false when unchecked', async () => {
    const loginMutation = renderLogin();

    fireEvent.click(rememberBox());
    expect(rememberBox()).not.toBeChecked();
    await submit();

    await waitFor(() =>
      expect(loginMutation.mutate).toHaveBeenCalledWith(
        expect.objectContaining({ rememberDevice: false }),
      ),
    );
  });
});
