import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AlertBanner from './AlertBanner';

describe('AlertBanner', () => {
  it('renders nothing when tier is null', () => {
    const { container } = render(<AlertBanner tier={null} message={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when message is empty', () => {
    const { container } = render(<AlertBanner tier="MONITORING" message="" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders MONITORING tier correctly', () => {
    render(<AlertBanner tier="MONITORING" message="All clear" />);
    expect(screen.getByText('ALL CLEAR')).toBeInTheDocument();
    expect(screen.getByText('All clear')).toBeInTheDocument();
  });

  it('renders ADVISORY tier correctly', () => {
    render(<AlertBanner tier="ADVISORY" message="Storm nearby" />);
    expect(screen.getByText('ADVISORY')).toBeInTheDocument();
  });

  it('renders ACTION_REQUIRED tier correctly', () => {
    render(<AlertBanner tier="ACTION_REQUIRED" message="Take action now" />);
    expect(screen.getByText('ACTION REQUIRED')).toBeInTheDocument();
  });

  it('renders IMMEDIATE_DANGER tier correctly', () => {
    render(<AlertBanner tier="IMMEDIATE_DANGER" message="Tornado imminent" />);
    expect(screen.getByText('DANGER')).toBeInTheDocument();
  });

  it('renders REROUTE action button', () => {
    render(<AlertBanner tier="ACTION_REQUIRED" message="Reroute" action="REROUTE" />);
    expect(screen.getByText('Take Alternate Route')).toBeInTheDocument();
  });

  it('renders PULL_OVER action button', () => {
    render(<AlertBanner tier="IMMEDIATE_DANGER" message="Pull over" action="PULL_OVER" />);
    expect(screen.getByText('Pull Over Safely')).toBeInTheDocument();
  });

  it('renders EMERGENCY_SHELTER_IN_VEHICLE action button', () => {
    render(<AlertBanner tier="IMMEDIATE_DANGER" message="Shelter" action="EMERGENCY_SHELTER_IN_VEHICLE" />);
    expect(screen.getByText('Shelter in Vehicle')).toBeInTheDocument();
  });

  it('renders CONTINUE_MONITORING action button', () => {
    render(<AlertBanner tier="MONITORING" message="Monitoring" action="CONTINUE_MONITORING" />);
    expect(screen.getByText('Continue Monitoring')).toBeInTheDocument();
  });

  it('calls onAction when action button clicked', () => {
    const onAction = vi.fn();
    render(<AlertBanner tier="ACTION_REQUIRED" message="Exit now" action="EXIT_TO_SHELTER" onAction={onAction} />);
    fireEvent.click(screen.getByText('Exit to Safe Location'));
    expect(onAction).toHaveBeenCalledWith('EXIT_TO_SHELTER');
  });

  it('shows confirmed state after clicking action', () => {
    render(<AlertBanner tier="ACTION_REQUIRED" message="Reroute" action="REROUTE" onAction={() => {}} />);
    fireEvent.click(screen.getByText('Take Alternate Route'));
    expect(screen.getByText('Route Updated')).toBeInTheDocument();
  });

  it('renders countdown timer', () => {
    render(<AlertBanner tier="IMMEDIATE_DANGER" message="Danger" countdown={5} />);
    expect(screen.getByText(/5 min/)).toBeInTheDocument();
    expect(screen.getByText(/IMMINENT/)).toBeInTheDocument();
  });

  it('shows shelter card for shelter actions', () => {
    const shelters = [{ name: 'Pilot Travel Center', distanceMiles: 2.3, exitNumber: '28', hasIndoorShelter: true }];
    render(<AlertBanner tier="ACTION_REQUIRED" message="Exit" action="EXIT_TO_SHELTER" shelters={shelters} />);
    expect(screen.getByText('Pilot Travel Center')).toBeInTheDocument();
    expect(screen.getByText(/2.3 mi/)).toBeInTheDocument();
  });

  it('shows alternate route card for reroute actions', () => {
    const altRoute = { distanceMiles: 45, timeMinutes: 55, safetyScore: 0.92 };
    render(<AlertBanner tier="ACTION_REQUIRED" message="Reroute" action="REROUTE" alternateRoute={altRoute} />);
    expect(screen.getByText('Alternate Route')).toBeInTheDocument();
    expect(screen.getByText(/45 mi/)).toBeInTheDocument();
  });
});
