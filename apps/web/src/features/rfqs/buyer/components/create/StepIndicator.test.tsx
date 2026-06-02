import { render, screen, fireEvent } from '@testing-library/react';

import { StepIndicator } from './StepIndicator';

const steps = ['Project', 'Materials', 'Vendors', 'Delivery & specs', 'Review'];

describe('StepIndicator', () => {
  it('renders all steps', () => {
    render(
      <StepIndicator steps={steps} current={0} furthestReached={0} onStepClick={vi.fn()} />,
    );
    steps.forEach((label) => expect(screen.getByText(label)).toBeInTheDocument());
  });

  it('marks the current step with aria-current', () => {
    render(
      <StepIndicator steps={steps} current={2} furthestReached={2} onStepClick={vi.fn()} />,
    );
    expect(screen.getByText('Vendors').closest('button')).toHaveAttribute('aria-current', 'step');
  });

  it('disables steps beyond the furthest reached', () => {
    render(
      <StepIndicator steps={steps} current={0} furthestReached={1} onStepClick={vi.fn()} />,
    );
    expect(screen.getByText('Vendors').closest('button')).toBeDisabled();
    expect(screen.getByText('Materials').closest('button')).not.toBeDisabled();
  });

  it('navigates to a reachable prior step on click', () => {
    const onStepClick = vi.fn();
    render(
      <StepIndicator steps={steps} current={2} furthestReached={2} onStepClick={onStepClick} />,
    );
    fireEvent.click(screen.getByText('Project'));
    expect(onStepClick).toHaveBeenCalledWith(0);
  });

  it('does not navigate to an unreachable step', () => {
    const onStepClick = vi.fn();
    render(
      <StepIndicator steps={steps} current={0} furthestReached={0} onStepClick={onStepClick} />,
    );
    fireEvent.click(screen.getByText('Review'));
    expect(onStepClick).not.toHaveBeenCalled();
  });
});
