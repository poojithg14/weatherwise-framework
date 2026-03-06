import { Circle, Polygon, Polyline, Popup, Tooltip } from 'react-leaflet';

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

function formatSpeed(vx, vy) {
  if (vx == null && vy == null) return null;
  const speed = Math.sqrt((vx || 0) ** 2 + (vy || 0) ** 2);
  return speed.toFixed(0);
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
        const speed = formatSpeed(cell.velocityX, cell.velocityY);

        return (
          <span key={`storm-group-${cell.id || index}`}>
            {/* Impact path — tornado ground track */}
            {cell.impactPath?.length >= 2 && (
              <Polyline
                positions={cell.impactPath.map(p => [p.lat, p.lon])}
                pathOptions={{
                  color: color,
                  weight: 3,
                  opacity: 0.5,
                }}
              />
            )}

            {/* Warning polygon overlay */}
            {cell.warnPolygon && cell.warnPolygon.length >= 3 && (
              <Polygon
                positions={cell.warnPolygon.map(p => [p.lat, p.lon])}
                pathOptions={{
                  color: color,
                  fillColor: color,
                  fillOpacity: 0.15,
                  weight: 2.5,
                  dashArray: '8,6',
                  opacity: 0.8,
                }}
              />
            )}

            {/* Main storm cell circle — clickable with popup */}
            <Circle
              center={[cell.lat, cell.lon]}
              radius={radiusMeters}
              pathOptions={{
                color: color,
                fillColor: color,
                fillOpacity: isExtreme ? 0.35 : 0.3,
                weight: 2,
                dashArray: isExtreme ? '' : '5,5'
              }}
              eventHandlers={{
                click: () => {},
              }}
            >
              <Tooltip permanent direction="top" offset={[0, -10]}>
                <span style={{ fontWeight: 'bold', color: color }}>
                  {label} {cell.severity ? `\u2014 ${cell.severity}` : ''}
                </span>
              </Tooltip>
              <Popup>
                <div style={{ color: '#e6edf3', minWidth: 180, lineHeight: 1.6 }}>
                  <strong style={{ color, fontSize: 14 }}>{label}</strong>
                  {cell.severity && (
                    <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.8 }}>({cell.severity})</span>
                  )}
                  <div style={{ fontSize: 12, marginTop: 6 }}>
                    {cell.hazardType && (
                      <div><span style={{ color: '#8b949e' }}>Type:</span> {cell.hazardType.replace(/_/g, ' ')}</div>
                    )}
                    {speed && (
                      <div><span style={{ color: '#8b949e' }}>Speed:</span> {speed} mph</div>
                    )}
                    {cell.vil != null && (
                      <div><span style={{ color: '#8b949e' }}>VIL:</span> {cell.vil} kg/m&sup2;</div>
                    )}
                    {cell.rotation != null && (
                      <div><span style={{ color: '#8b949e' }}>Rotation:</span> {cell.rotation}&deg;/s</div>
                    )}
                  </div>
                </div>
              </Popup>
            </Circle>

            {/* Impact path — dashed polyline through predicted positions */}
            {cell.predictedPath && cell.predictedPath.length > 0 && (() => {
              const pathPoints = [[cell.lat, cell.lon]];
              cell.predictedPath.forEach(future => {
                if (future.lat != null && future.lon != null) {
                  pathPoints.push([future.lat, future.lon]);
                } else if (future.vertices && future.vertices.length > 0) {
                  // Use centroid of polygon vertices
                  const avgLat = future.vertices.reduce((s, v) => s + v.lat, 0) / future.vertices.length;
                  const avgLon = future.vertices.reduce((s, v) => s + v.lon, 0) / future.vertices.length;
                  pathPoints.push([avgLat, avgLon]);
                }
              });
              if (pathPoints.length < 2) return null;
              return (
                <Polyline
                  positions={pathPoints}
                  pathOptions={{
                    color: color,
                    weight: 3,
                    opacity: 0.7,
                    dashArray: '6,8',
                  }}
                />
              );
            })()}

            {/* Predicted path — show future positions as fading circles */}
            {cell.predictedPath?.map((future, fi) => (
              <Circle
                key={`pred-${cell.id || index}-${fi}`}
                center={
                  future.lat != null && future.lon != null
                    ? [future.lat, future.lon]
                    : future.vertices && future.vertices.length > 0
                      ? [
                          future.vertices.reduce((s, v) => s + v.lat, 0) / future.vertices.length,
                          future.vertices.reduce((s, v) => s + v.lon, 0) / future.vertices.length,
                        ]
                      : [cell.lat, cell.lon]
                }
                radius={radiusMeters * 1.1}
                pathOptions={{
                  color: color,
                  fillColor: color,
                  fillOpacity: Math.max(0.05, 0.25 - fi * 0.04),
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
