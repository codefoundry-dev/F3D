import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@forethread/ui-components', () => ({
  FormField: ({ children, label, error }: any) => (
    <div>
      <label>{label}</label>
      {children}
      {error && <span data-testid="error">{error}</span>}
    </div>
  ),
  CustomDropdown: (props: any) => (
    <select
      aria-label="project"
      value={props.value ?? ''}
      onChange={(e: any) => props.onChange?.(e.target.value)}
    >
      <option value="">{props.placeholder}</option>
      {props.options.map((o: any) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));

import { StepProject } from './StepProject';

const projects = [
  { id: 'p1', name: 'Tower 5' },
  { id: 'p2', name: 'Bridge 9' },
] as any;

describe('StepProject', () => {
  it('renders the heading and project options', () => {
    render(<StepProject projects={projects} value="" onChange={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Project' })).toBeInTheDocument();
    expect(screen.getByText('Tower 5')).toBeInTheDocument();
    expect(screen.getByText('Bridge 9')).toBeInTheDocument();
  });

  it('calls onChange with the selected project id', () => {
    const onChange = vi.fn();
    render(<StepProject projects={projects} value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('project'), { target: { value: 'p2' } });
    expect(onChange).toHaveBeenCalledWith('p2');
  });

  it('renders a validation error when provided', () => {
    render(<StepProject projects={projects} value="" onChange={vi.fn()} error="Select a project" />);
    expect(screen.getByTestId('error')).toHaveTextContent('Select a project');
  });
});
