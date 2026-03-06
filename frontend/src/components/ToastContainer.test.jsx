import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ToastContainer from './ToastContainer';

describe('ToastContainer', () => {
  it('renders nothing when toasts array is empty', () => {
    const { container } = render(<ToastContainer toasts={[]} onRemove={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when toasts is null', () => {
    const { container } = render(<ToastContainer toasts={null} onRemove={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders toast messages', () => {
    const toasts = [
      { id: 1, message: 'Success!', type: 'success' },
      { id: 2, message: 'Error occurred', type: 'error' },
    ];
    render(<ToastContainer toasts={toasts} onRemove={() => {}} />);
    expect(screen.getByText('Success!')).toBeInTheDocument();
    expect(screen.getByText('Error occurred')).toBeInTheDocument();
  });

  it('applies correct type styles', () => {
    const toasts = [{ id: 1, message: 'Warning', type: 'warning' }];
    render(<ToastContainer toasts={toasts} onRemove={() => {}} />);
    const toast = screen.getByText('Warning').closest('div[class*="animate"]');
    expect(toast.className).toContain('bg-yellow-600');
  });

  it('calls onRemove when close button clicked', () => {
    const onRemove = vi.fn();
    const toasts = [{ id: 42, message: 'Dismiss me', type: 'info' }];
    render(<ToastContainer toasts={toasts} onRemove={onRemove} />);
    const closeBtn = screen.getByRole('button');
    fireEvent.click(closeBtn);
    expect(onRemove).toHaveBeenCalledWith(42);
  });
});
