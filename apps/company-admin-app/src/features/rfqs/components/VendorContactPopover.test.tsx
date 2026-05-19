import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

vi.mock('@forethread/ui-components/assets/icons/envelope-simple.svg?react', () => ({
  default: () => <span data-testid="envelope-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/phone.svg?react', () => ({
  default: () => <span data-testid="phone-icon" />,
}));

import { VendorContactPopover } from './VendorContactPopover';

const contacts = [
  { id: 'c1', name: 'John Doe', role: 'Sales Manager', phone: '+123', email: 'john@test.com' },
  { id: 'c2', name: 'Jane Smith', role: 'Account Rep', phone: null, email: 'jane@test.com' },
] as never[];

describe('VendorContactPopover', () => {
  it('renders trigger button with children', () => {
    render(
      <VendorContactPopover contacts={contacts}>
        <span>Click me</span>
      </VendorContactPopover>,
    );
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('opens popover on click', () => {
    render(
      <VendorContactPopover contacts={contacts}>
        <span>Trigger</span>
      </VendorContactPopover>,
    );
    fireEvent.click(screen.getByText('Trigger'));
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Sales Manager')).toBeInTheDocument();
    expect(screen.getByText('john@test.com')).toBeInTheDocument();
  });

  it('shows phone when available', () => {
    render(
      <VendorContactPopover contacts={contacts}>
        <span>Trigger</span>
      </VendorContactPopover>,
    );
    fireEvent.click(screen.getByText('Trigger'));
    expect(screen.getByText('+123')).toBeInTheDocument();
  });

  it('closes on second click (toggle)', () => {
    render(
      <VendorContactPopover contacts={contacts}>
        <span>Trigger</span>
      </VendorContactPopover>,
    );
    fireEvent.click(screen.getByText('Trigger'));
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Trigger'));
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });

  it('closes on Escape key', () => {
    render(
      <VendorContactPopover contacts={contacts}>
        <span>Trigger</span>
      </VendorContactPopover>,
    );
    fireEvent.click(screen.getByText('Trigger'));
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });

  it('closes on outside click', () => {
    render(
      <div>
        <VendorContactPopover contacts={contacts}>
          <span>Trigger</span>
        </VendorContactPopover>
        <div data-testid="outside">Outside</div>
      </div>,
    );
    fireEvent.click(screen.getByText('Trigger'));
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });
});
