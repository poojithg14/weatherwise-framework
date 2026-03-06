import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import RiskGauge from './RiskGauge';

describe('RiskGauge', () => {
  it('renders risk score as percentage', () => {
    render(<RiskGauge score={0.75} tier="ACTION_REQUIRED" />);
    expect(screen.getByText('75')).toBeInTheDocument();
    expect(screen.getByText('Risk')).toBeInTheDocument();
  });

  it('renders tier label', () => {
    render(<RiskGauge score={0.2} tier="MONITORING" />);
    expect(screen.getByText('Monitoring')).toBeInTheDocument();
  });

  it('renders ADVISORY tier', () => {
    render(<RiskGauge score={0.4} tier="ADVISORY" />);
    expect(screen.getByText('Advisory')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
  });

  it('renders IMMEDIATE_DANGER tier', () => {
    render(<RiskGauge score={0.92} tier="IMMEDIATE_DANGER" />);
    expect(screen.getByText('Immediate Danger')).toBeInTheDocument();
    expect(screen.getByText('92')).toBeInTheDocument();
  });

  it('defaults to MONITORING with score 0', () => {
    render(<RiskGauge />);
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('Monitoring')).toBeInTheDocument();
  });

  it('renders SVG circles for gauge', () => {
    const { container } = render(<RiskGauge score={0.5} tier="ADVISORY" />);
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(2);
  });
});
