import { InlineEditCell } from '@forethread/ui-components';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// FOR-365: cost codes edit in place — click / Enter / F2 opens, Enter or blur
// saves, Esc cancels, optimistic value rolls back on a failed save.
function setup(props: Partial<Parameters<typeof InlineEditCell>[0]> = {}) {
  const onSave = vi.fn<(next: string) => Promise<unknown>>().mockResolvedValue(undefined);
  render(
    <InlineEditCell
      value="CC-100"
      label="Cost code"
      onSave={onSave}
      data-testid="cell"
      {...props}
    />,
  );
  return { onSave: (props.onSave as typeof onSave | undefined) ?? onSave };
}

const input = () => screen.getByTestId('cell-input');

describe('InlineEditCell', () => {
  it('shows the value as a button and opens an editor on click', () => {
    setup();
    expect(screen.getByTestId('cell')).toHaveTextContent('CC-100');
    fireEvent.click(screen.getByTestId('cell'));
    expect(input()).toHaveValue('CC-100');
    expect(input()).toHaveFocus();
  });

  it('opens on F2 from the focused cell', () => {
    setup();
    fireEvent.keyDown(screen.getByTestId('cell'), { key: 'F2' });
    expect(input()).toBeInTheDocument();
  });

  it('saves the trimmed value on Enter and returns focus to the cell', async () => {
    const { onSave } = setup();
    fireEvent.click(screen.getByTestId('cell'));
    fireEvent.change(input(), { target: { value: '  CC-200 ' } });
    await act(async () => {
      fireEvent.keyDown(input(), { key: 'Enter' });
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('CC-200');
    expect(screen.getByTestId('cell')).toHaveFocus();
  });

  it('saves on blur', async () => {
    const { onSave } = setup();
    fireEvent.click(screen.getByTestId('cell'));
    fireEvent.change(input(), { target: { value: 'CC-300' } });
    await act(async () => {
      fireEvent.blur(input());
    });
    expect(onSave).toHaveBeenCalledWith('CC-300');
  });

  it('cancels on Escape without saving', () => {
    const { onSave } = setup();
    fireEvent.click(screen.getByTestId('cell'));
    fireEvent.change(input(), { target: { value: 'nope' } });
    fireEvent.keyDown(input(), { key: 'Escape' });
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByTestId('cell')).toHaveTextContent('CC-100');
    expect(screen.getByTestId('cell')).toHaveFocus();
  });

  it('skips the request when the value is unchanged', () => {
    const { onSave } = setup();
    fireEvent.click(screen.getByTestId('cell'));
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(onSave).not.toHaveBeenCalled();
  });

  it('shows the new value optimistically while saving', async () => {
    let resolve!: () => void;
    const onSave = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    setup({ onSave });
    fireEvent.click(screen.getByTestId('cell'));
    fireEvent.change(input(), { target: { value: 'CC-NEW' } });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(screen.getByTestId('cell')).toHaveTextContent('CC-NEW');
    expect(screen.getByTestId('cell')).toHaveAttribute('aria-busy', 'true');
    await act(async () => resolve());
    expect(screen.getByTestId('cell')).not.toHaveAttribute('aria-busy');
  });

  it('rolls back to the saved value and shows an inline error when the save fails', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('boom'));
    setup({ onSave, getErrorMessage: () => 'Save failed' });
    fireEvent.click(screen.getByTestId('cell'));
    fireEvent.change(input(), { target: { value: 'CC-BAD' } });
    await act(async () => {
      fireEvent.keyDown(input(), { key: 'Enter' });
    });
    expect(screen.getByTestId('cell')).toHaveTextContent('CC-100');
    expect(screen.getByTestId('cell-error')).toHaveTextContent('Save failed');
  });

  it('blocks the save and keeps the editor open on a validation error', () => {
    const { onSave } = setup({ validate: (v) => (v.length > 3 ? 'Too long' : null) });
    fireEvent.click(screen.getByTestId('cell'));
    fireEvent.change(input(), { target: { value: 'ABCDE' } });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(onSave).not.toHaveBeenCalled();
    expect(input()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('cell-error')).toHaveTextContent('Too long');
  });

  it('renders plain text with no editor when not editable', () => {
    setup({ editable: false, value: null });
    const cell = screen.getByTestId('cell');
    expect(cell.tagName).toBe('SPAN');
    expect(cell).toHaveTextContent('—');
    fireEvent.click(cell);
    expect(screen.queryByTestId('cell-input')).not.toBeInTheDocument();
  });
});
