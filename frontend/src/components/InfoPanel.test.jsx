import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import InfoPanel from './InfoPanel';

describe('InfoPanel', () => {
  it('renders nothing when no data', () => {
    const { container } = render(<InfoPanel data={null} elapsedMinutes={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders elapsed time', () => {
    render(<InfoPanel data={{}} elapsedMinutes={15} />);
    expect(screen.getByText('15 min')).toBeInTheDocument();
    expect(screen.getByText('Elapsed Time')).toBeInTheDocument();
  });

  it('renders storm cells', () => {
    const data = {
      stormCells: [
        { id: 'storm-1', hazardType: 'TORNADO', severity: 'EXTREME' },
        { id: 'storm-2', hazardType: 'FLASH_FLOOD', severity: 'SEVERE' },
      ],
    };
    render(<InfoPanel data={data} elapsedMinutes={5} />);
    expect(screen.getByText('Active Hazards')).toBeInTheDocument();
    expect(screen.getByText('EXTREME')).toBeInTheDocument();
    expect(screen.getByText('SEVERE')).toBeInTheDocument();
  });

  it('renders shelters with distance and exit', () => {
    const data = {
      shelters: [
        { name: 'Pilot Travel Center', distanceMiles: 2.3, exitNumber: '28', hasIndoorShelter: true },
      ],
    };
    render(<InfoPanel data={data} elapsedMinutes={10} />);
    expect(screen.getByText('Nearby Shelters')).toBeInTheDocument();
    expect(screen.getByText('Pilot Travel Center')).toBeInTheDocument();
    expect(screen.getByText('2.3 mi')).toBeInTheDocument();
    expect(screen.getByText('Exit 28')).toBeInTheDocument();
    expect(screen.getByText('Indoor Shelter')).toBeInTheDocument();
  });

  it('renders alternate route info', () => {
    const data = {
      alternateRoute: {
        description: 'Via US-60',
        distanceMiles: 12.5,
        timeMinutes: 18,
        safetyScore: 0.85,
      },
    };
    render(<InfoPanel data={data} elapsedMinutes={5} />);
    expect(screen.getByText('Alternate Route Available')).toBeInTheDocument();
    expect(screen.getByText('Via US-60')).toBeInTheDocument();
    expect(screen.getByText('12.5 mi')).toBeInTheDocument();
    expect(screen.getByText('~18 min')).toBeInTheDocument();
    expect(screen.getByText('Safety: 85%')).toBeInTheDocument();
  });

  it('does not render sections with empty arrays', () => {
    const data = { stormCells: [], shelters: [] };
    render(<InfoPanel data={data} elapsedMinutes={0} />);
    expect(screen.queryByText('Active Hazards')).not.toBeInTheDocument();
    expect(screen.queryByText('Nearby Shelters')).not.toBeInTheDocument();
  });
});
