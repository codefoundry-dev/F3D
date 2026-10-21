import { GridModal, Modal } from '@forethread/ui-components';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// ADR-0019 / FOR-372: below 768px, modals ≤560px wide become bottom sheets
// (grab handle, swipe-down closes); wider ones stay full-screen.
const handle = () => screen.queryByTestId('modal-sheet-handle');

describe('Modal phone layout', () => {
  it('defaults to a bottom sheet for the standard 560px card', () => {
    render(<Modal onClose={() => {}}>body</Modal>);
    expect(handle()).toBeInTheDocument();
  });

  it.each(['max-w-[560px]', 'max-w-[480px]', 'max-w-md'])('is a sheet for %s', (maxWidth) => {
    render(
      <Modal onClose={() => {}} maxWidth={maxWidth}>
        body
      </Modal>,
    );
    expect(handle()).toBeInTheDocument();
  });

  it.each(['max-w-[640px]', 'max-w-[1024px] min-w-[860px]', 'max-w-4xl'])(
    'stays full-screen for %s',
    (maxWidth) => {
      render(
        <Modal onClose={() => {}} maxWidth={maxWidth}>
          body
        </Modal>,
      );
      expect(handle()).not.toBeInTheDocument();
    },
  );

  it('honours an explicit mobile override', () => {
    render(
      <Modal onClose={() => {}} mobile="fullscreen">
        body
      </Modal>,
    );
    expect(handle()).not.toBeInTheDocument();
  });

  it('closes on a downward swipe of the grab handle, not on a short one', () => {
    const onClose = vi.fn();
    render(<Modal onClose={onClose}>body</Modal>);
    const h = handle()!;

    fireEvent.touchStart(h, { touches: [{ clientY: 100 }] });
    fireEvent.touchEnd(h, { changedTouches: [{ clientY: 130 }] });
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.touchStart(h, { touches: [{ clientY: 100 }] });
    fireEvent.touchEnd(h, { changedTouches: [{ clientY: 200 }] });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('GridModal: md is a sheet, lg is full-screen', () => {
    const { unmount } = render(<GridModal onClose={() => {}} icon={null} title="Small" />);
    expect(handle()).toBeInTheDocument();
    unmount();

    render(<GridModal onClose={() => {}} icon={null} title="Big" size="lg" />);
    expect(handle()).not.toBeInTheDocument();
  });
});
