import { Circle, Polygon, Polyline, Tooltip } from 'react-leaflet';

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
  if (cell.radiusMiles) return cell.radiusMiles * 1609.34;
  if (cell.rotation) return cell.rotation * 100;
  return 5 * 1609.34;
}

function getCellLabel(cell) {
  if (cell.type) return cell.type;
  if (cell.hazardType) return cell.hazardType.replace(/_/g, ' ');
  return 'Storm Cell';
}

function getWarningLabel(cell) {
  if (cell.hazardType === 'TORNADO' || cell.type?.includes('Tornado') || cell.type?.includes('tornado'))
    return 'TORNADO WARNING ZONE';
  if (cell.hazardType === 'FLASH_FLOOD') return 'FLOOD WARNING ZONE';
  if (cell.hazardType === 'BLIZZARD') return 'BLIZZARD WARNING ZONE';
  if (cell.hazardType === 'WILDFIRE') return 'WILDFIRE WARNING ZONE';
  return 'SEVERE WEATHER WARNING ZONE';
}

// Build a corridor polygon from center points by offsetting N/S
function buildCorridor(centerPoints, halfWidthDeg) {
  if (!centerPoints || centerPoints.length < 2) return null;
  const north = centerPoints.map(p => [p.lat + halfWidthDeg, p.lon]);
  const south = [...centerPoints].reverse().map(p => [p.lat - halfWidthDeg, p.lon]);
  return [...north, ...south];
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
        const halfWidth = cell.pathWidthMiles ? (cell.pathWidthMiles / 2) * 0.0145 : 0;
        const key = cell.id || index;

        return (
          <span key={`storm-group-${key}`}>
            {/* ── Layer 1: WARNING ZONE polygon ── */}
            {cell.warnPolygon && cell.warnPolygon.length >= 3 && (
              <Polygon
                positions={cell.warnPolygon.map(p => [p.lat, p.lon])}
                pathOptions={{
                  color: '#DC2626',
                  fillColor: '#DC2626',
                  fillOpacity: 0.08,
                  weight: 2,
                  dashArray: '8,6',
                }}
              >
                <Tooltip direction="center" permanent={false}>
                  <span style={{ fontWeight: 'bold', color: '#DC2626' }}>
                    {getWarningLabel(cell)}
                  </span>
                </Tooltip>
              </Polygon>
            )}

            {/* ── Layer 2: DAMAGE PATH CORRIDOR ── */}
            {cell.impactPath && cell.impactPath.length >= 2 && halfWidth > 0 && (() => {
              const currentLat = cell.lat;
              const past = cell.impactPath.filter(p => p.lon <= cell.lon);
              const future = cell.impactPath.filter(p => p.lon > cell.lon);

              // If all points are past or future, use the full path
              const pastPts = past.length >= 2 ? past : (future.length < 2 ? cell.impactPath : []);
              const futurePts = future.length >= 2 ? future : [];

              // Connect past end to future start if both exist
              if (pastPts.length > 0 && futurePts.length > 0) {
                const lastPast = pastPts[pastPts.length - 1];
                if (futurePts[0].lat !== lastPast.lat || futurePts[0].lon !== lastPast.lon) {
                  futurePts.unshift(lastPast);
                }
              }

              return (
                <>
                  {/* Past corridor - solid */}
                  {pastPts.length >= 2 && (
                    <Polygon
                      positions={buildCorridor(pastPts, halfWidth)}
                      pathOptions={{
                        color: '#DC2626',
                        fillColor: '#DC2626',
                        fillOpacity: 0.35,
                        weight: 1,
                      }}
                    >
                      <Tooltip direction="center" permanent={false}>
                        <span style={{ color: '#DC2626', fontWeight: 'bold' }}>Damage Path (observed)</span>
                      </Tooltip>
                    </Polygon>
                  )}
                  {/* Future corridor - dashed, lighter */}
                  {futurePts.length >= 2 && (
                    <Polygon
                      positions={buildCorridor(futurePts, halfWidth)}
                      pathOptions={{
                        color: '#EF4444',
                        fillColor: '#EF4444',
                        fillOpacity: 0.20,
                        weight: 1,
                        dashArray: '6,4',
                      }}
                    >
                      <Tooltip direction="center" permanent={false}>
                        <span style={{ color: '#EF4444', fontWeight: 'bold' }}>Projected Path</span>
                      </Tooltip>
                    </Polygon>
                  )}
                  {/* Center line along impact path */}
                  <Polyline
                    positions={cell.impactPath.map(p => [p.lat, p.lon])}
                    pathOptions={{
                      color: '#DC2626',
                      weight: 2,
                      dashArray: '4,4',
                      opacity: 0.7,
                    }}
                  />
                </>
              );
            })()}

            {/* ── Layer 3: CURRENT CELL circle ── */}
            <Circle
              center={[cell.lat, cell.lon]}
              radius={radiusMeters}
              className={isExtreme ? 'storm-pulse-extreme' : ''}
              pathOptions={{
                color: color,
                fillColor: color,
                fillOpacity: 0.3,
                weight: 2,
                dashArray: isExtreme ? '' : '5,5',
              }}
            >
              <Tooltip permanent direction="top" offset={[0, -10]}>
                <span style={{ fontWeight: 'bold', color: color }}>
                  {label} {cell.severity ? `\u2014 ${cell.severity}` : ''}
                </span>
              </Tooltip>
            </Circle>

            {/* ── Layer 4: PREDICTED POSITIONS ── */}
            {cell.predictedPath?.map((future, fi) => (
              <Circle
                key={`pred-${key}-${fi}`}
                center={[future.lat, future.lon]}
                radius={radiusMeters * 1.1}
                pathOptions={{
                  color: color,
                  fillColor: color,
                  fillOpacity: Math.max(0.05, 0.2 - fi * 0.04),
                  weight: 1,
                  dashArray: '3,6',
                }}
              >
                <Tooltip direction="top" permanent={false}>
                  <span style={{ color: color }}>+{(fi + 1) * 5} min</span>
                </Tooltip>
              </Circle>
            ))}
          </span>
        );
      })}
    </>
  );
}
