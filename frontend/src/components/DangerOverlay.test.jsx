import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import DangerOverlay from './DangerOverlay';

describe('DangerOverlay', () => {
  it('renders nothing when not active', () => {
    const { container } = render(<DangerOverlay active={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders overlay when active', () => {
    render(<DangerOverlay active={true} />);
    expect(screen.getByText('Immediate Danger')).toBeInTheDocument();
  });

  it('shows custom message', () => {
    render(<DangerOverlay active={true} message="Tornado approaching!" />);
    expect(screen.getByText('Tornado approaching!')).toBeInTheDocument();
  });

  it('shows default message when none provided', () => {
    render(<DangerOverlay active={true} />);
    expect(screen.getByText('TAKE SHELTER NOW')).toBeInTheDocument();
  });
});
