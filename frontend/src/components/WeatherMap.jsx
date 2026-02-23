import React, { useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Polygon,
  Popup,
  ScaleControl,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';

// Dark CartoDB tile URL
const DARK_TILE_URL =
  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const DARK_TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';

// Default center on I-64 Louisville area
const DEFAULT_CENTER = [38.22, -85.45];
const DEFAULT_ZOOM = 10;

// Create traveler arrow icon as SVG data URI
function createTravelerIcon(heading) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <g transform="rotate(${heading}, 16, 16)">
        <polygon points="16,2 26,28 16,22 6,28" fill="#4285F4" stroke="#FFFFFF" stroke-width="2"/>
      </g>
    </svg>
  `;
  const encoded = encodeURIComponent(svg.trim());
  return L.divIcon({
    html: `<img src="data:image/svg+xml,${encoded}" width="32" height="32" class="traveler-icon" />`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    className: '',
  });
}

// Create shelter marker icon
function createShelterIcon(hasIndoorShelter) {
  const fillColor = hasIndoorShelter ? '#2E7D32' : '#F9A825';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
      <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.27 21.73 0 14 0z" fill="${fillColor}" stroke="#FFFFFF" stroke-width="1.5"/>
      <circle cx="14" cy="13" r="6" fill="#FFFFFF" opacity="0.9"/>
      <path d="M14 8l-5 5h2v4h6v-4h2L14 8z" fill="${fillColor}"/>
    </svg>
  `;
  const encoded = encodeURIComponent(svg.trim());
  return L.divIcon({
    html: `<img src="data:image/svg+xml,${encoded}" width="28" height="36" class="shelter-icon" />`,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -36],
    className: '',
  });
}

// Get polygon color based on tier / type
function getStormCellColor(cell) {
  switch (cell.type) {
    case 'TORNADO':
      return { fill: 'rgba(211, 47, 47, 0.25)', stroke: '#D32F2F' };
    case 'SEVERE_THUNDERSTORM':
      return { fill: 'rgba(230, 81, 0, 0.2)', stroke: '#E65100' };
    default:
      return { fill: 'rgba(249, 168, 37, 0.15)', stroke: '#F9A825' };
  }
}

export default function WeatherMap({
  traveler,
  stormCells = [],
  alertPolygons = [],
  safeLocations = [],
  currentRoute,
  alternateRoute,
  routeSafe = true,
  showStormCells = true,
  showAlertPolygons = true,
  showAlternateRoute = false,
}) {
  const travelerIcon = useMemo(
    () => createTravelerIcon(traveler?.heading || 0),
    [traveler?.heading]
  );

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      className="w-full h-full"
      zoomControl={true}
      attributionControl={true}
      style={{ width: '100%', height: '100%' }}
    >
      {/* Dark base tiles */}
      <TileLayer url={DARK_TILE_URL} attribution={DARK_TILE_ATTR} />

      {/* Scale bar */}
      <ScaleControl position="bottomleft" imperial={true} metric={false} />

      {/* NWS Alert polygon outlines */}
      {showAlertPolygons &&
        alertPolygons.map((alert) => (
          <Polygon
            key={alert.id}
            positions={alert.polygon}
            pathOptions={{
              color: alert.borderColor,
              fillColor: alert.fillColor,
              fillOpacity: 1,
              weight: 2,
              dashArray: '8, 4',
              opacity: 0.7,
            }}
          >
            <Popup>
              <div style={{ color: '#e6edf3', minWidth: 180 }}>
                <strong style={{ color: alert.color }}>{alert.label}</strong>
                <br />
                <span style={{ fontSize: 12 }}>{alert.headline}</span>
                <br />
                <span style={{ fontSize: 11, color: '#8b949e' }}>
                  Source: {alert.source}
                </span>
              </div>
            </Popup>
          </Polygon>
        ))}

      {/* Storm cell polygons */}
      {showStormCells &&
        stormCells.map((cell) => {
          const colors = getStormCellColor(cell);
          return (
            <React.Fragment key={cell.id}>
              {/* Main storm cell polygon */}
              <Polygon
                positions={cell.polygon}
                pathOptions={{
                  color: colors.stroke,
                  fillColor: colors.fill,
                  fillOpacity: 1,
                  weight: 2,
                  opacity: 0.9,
                }}
              >
                <Popup>
                  <div style={{ color: '#e6edf3', minWidth: 160 }}>
                    <strong style={{ color: colors.stroke }}>{cell.label}</strong>
                    <br />
                    <span style={{ fontSize: 12 }}>
                      Wind: {cell.maxWindSpeed} mph | Hail: {cell.hailSize}"
                    </span>
                    <br />
                    <span style={{ fontSize: 12 }}>
                      Moving: {cell.movementBearing}&deg; at {cell.movementSpeed} mph
                    </span>
                  </div>
                </Popup>
              </Polygon>

              {/* Predicted path polygons */}
              {cell.predictedPath &&
                cell.predictedPath.map((pred, idx) => (
                  <Polygon
                    key={`${cell.id}-pred-${idx}`}
                    positions={pred.polygon}
                    pathOptions={{
                      color: colors.stroke,
                      fillColor: colors.fill,
                      fillOpacity: pred.opacity * 0.5,
                      weight: 1,
                      opacity: pred.opacity,
                      dashArray: '4, 4',
                    }}
                  >
                    <Popup>
                      <div style={{ color: '#e6edf3' }}>
                        <strong>{cell.label}</strong>
                        <br />
                        <span style={{ fontSize: 12 }}>
                          Predicted position in {pred.time} min
                        </span>
                      </div>
                    </Popup>
                  </Polygon>
                ))}
            </React.Fragment>
          );
        })}

      {/* Current route polyline */}
      {currentRoute && (
        <Polyline
          positions={currentRoute.waypoints}
          pathOptions={{
            color: routeSafe ? '#2E7D32' : '#D32F2F',
            weight: 5,
            opacity: 0.85,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        >
          <Popup>
            <div style={{ color: '#e6edf3' }}>
              <strong>{currentRoute.name}</strong>
              <br />
              <span style={{ fontSize: 12 }}>
                {currentRoute.distance} mi | ~{Math.floor(currentRoute.estimatedTime / 60)}h{' '}
                {currentRoute.estimatedTime % 60}m
              </span>
              <br />
              <span
                style={{
                  fontSize: 12,
                  color: routeSafe ? '#66BB6A' : '#EF5350',
                  fontWeight: 'bold',
                }}
              >
                {routeSafe ? 'Route Clear' : 'ROUTE IN DANGER ZONE'}
              </span>
            </div>
          </Popup>
        </Polyline>
      )}

      {/* Alternate route polyline (dashed green) */}
      {showAlternateRoute && alternateRoute && (
        <Polyline
          positions={alternateRoute.waypoints}
          pathOptions={{
            color: '#2E7D32',
            weight: 4,
            opacity: 0.75,
            dashArray: '12, 8',
            lineCap: 'round',
            lineJoin: 'round',
          }}
        >
          <Popup>
            <div style={{ color: '#e6edf3' }}>
              <strong>{alternateRoute.name}</strong>
              <br />
              <span style={{ fontSize: 12 }}>
                {alternateRoute.distance} mi | ~{Math.floor(alternateRoute.estimatedTime / 60)}h{' '}
                {alternateRoute.estimatedTime % 60}m
              </span>
              <br />
              <span style={{ fontSize: 12, color: '#66BB6A', fontWeight: 'bold' }}>
                Recommended Safe Route (+{alternateRoute.addedTime} min)
              </span>
            </div>
          </Popup>
        </Polyline>
      )}

      {/* Safe location markers */}
      {safeLocations.map((loc) => (
        <Marker
          key={loc.id}
          position={[loc.latitude, loc.longitude]}
          icon={createShelterIcon(loc.hasIndoorShelter)}
        >
          <Popup>
            <div style={{ color: '#e6edf3', minWidth: 160 }}>
              <strong style={{ color: '#66BB6A' }}>{loc.name}</strong>
              <br />
              <span style={{ fontSize: 12 }}>{loc.exitInfo}</span>
              <br />
              <span style={{ fontSize: 12 }}>
                {loc.distance} mi | {loc.driveTime} min drive
              </span>
              {loc.hasIndoorShelter && (
                <>
                  <br />
                  <span
                    style={{
                      fontSize: 11,
                      color: '#66BB6A',
                      fontWeight: 'bold',
                    }}
                  >
                    Has Indoor Shelter
                  </span>
                </>
              )}
              {loc.phone && (
                <>
                  <br />
                  <span style={{ fontSize: 11, color: '#8b949e' }}>{loc.phone}</span>
                </>
              )}
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Traveler marker */}
      {traveler && (
        <Marker
          position={[traveler.latitude, traveler.longitude]}
          icon={travelerIcon}
          zIndexOffset={1000}
        >
          <Popup>
            <div style={{ color: '#e6edf3' }}>
              <strong style={{ color: '#4285F4' }}>Your Location</strong>
              <br />
              <span style={{ fontSize: 12 }}>
                Heading: {traveler.heading}&deg; | Speed: {traveler.speed} mph
              </span>
            </div>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
