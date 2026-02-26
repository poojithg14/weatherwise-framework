import { Circle, Tooltip } from 'react-leaflet';

const SEVERITY_COLORS = {
  EXTREME: '#DC2626',
  SEVERE: '#F97316',
  MODERATE: '#EAB308',
};

const HAZARD_COLORS = {
  TORNADO: '#DC2626',
  SEVERE_THUNDERSTORM: '#F97316',
  FLASH_FLOOD: '#1E88E5',
  BLIZZARD: '#64B5F6',
  WILDFIRE: '#FF9800',
};

function getCellColor(cell) {
  if (cell.severity && SEVERITY_COLORS[cell.severity]) return SEVERITY_COLORS[cell.severity];
  if (cell.hazardType && HAZARD_COLORS[cell.hazardType]) return HAZARD_COLORS[cell.hazardType];
  return '#6B7280';
}

function getCellRadius(cell) {
  // New format: radiusMiles; Old format: rotation (used as multiplier)
  if (cell.radiusMiles) return cell.radiusMiles * 1609.34;
  if (cell.rotation) return cell.rotation * 100;
  return 5 * 1609.34; // default 5 miles
}

function getCellLabel(cell) {
  if (cell.type) return cell.type;
  if (cell.hazardType) return cell.hazardType.replace(/_/g, ' ');
  return 'Storm Cell';
}

export default function StormCellLayer({ stormCells }) {
  if (!stormCells || stormCells.length === 0) return null;

  return (
    <>
      {stormCells.map((cell, index) => {
        const color = getCellColor(cell);
        const radiusMeters = getCellRadius(cell);
        const label = getCellLabel(cell);
        const isExtreme = cell.severity === 'EXTREME' || cell.hazardType === 'TORNADO';

        return (
          <span key={`storm-group-${cell.id || index}`}>
            {/* Main storm cell circle */}
            <Circle
              center={[cell.lat, cell.lon]}
              radius={radiusMeters}
              pathOptions={{
                color: color,
                fillColor: color,
                fillOpacity: 0.3,
                weight: 2,
                dashArray: isExtreme ? '' : '5,5'
              }}
            >
              <Tooltip permanent direction="top" offset={[0, -10]}>
                <span style={{ fontWeight: 'bold', color: color }}>
                  {label} {cell.severity ? `\u2014 ${cell.severity}` : ''}
                </span>
              </Tooltip>
            </Circle>

            {/* Predicted path — show future positions as fading circles */}
            {cell.predictedPath?.map((future, fi) => (
              <Circle
                key={`pred-${cell.id || index}-${fi}`}
                center={[future.lat, future.lon]}
                radius={radiusMeters * 1.1}
                pathOptions={{
                  color: color,
                  fillColor: color,
                  fillOpacity: Math.max(0.05, 0.2 - fi * 0.04),
                  weight: 1,
                  dashArray: '3,6'
                }}
              />
            ))}
          </span>
        );
      })}
    </>
  );
}
