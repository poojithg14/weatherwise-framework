import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MapSkeleton, SidebarSkeleton } from './LoadingSkeleton';

describe('MapSkeleton', () => {
  it('renders loading text', () => {
    render(<MapSkeleton />);
    expect(screen.getByText('Loading map data...')).toBeInTheDocument();
  });

  it('renders a spinner element', () => {
    const { container } = render(<MapSkeleton />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });
});

describe('SidebarSkeleton', () => {
  it('renders skeleton pulse elements', () => {
    const { container } = render(<SidebarSkeleton />);
    const pulseElements = container.querySelectorAll('.animate-skeleton');
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it('renders surface-styled containers', () => {
    const { container } = render(<SidebarSkeleton />);
    const surfaces = container.querySelectorAll('.rounded-xl');
    expect(surfaces.length).toBe(2);
  });
});
