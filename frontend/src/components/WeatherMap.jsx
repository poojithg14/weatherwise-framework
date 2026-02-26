import { useMemo, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  ScaleControl,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import { useEffect } from 'react';
import RouteLayer from './Map/RouteLayer';
import TravelerMarker from './Map/TravelerMarker';
import StormCellLayer from './Map/StormCellLayer';

const DARK_TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const DARK_TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';

function createShelterIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.27 21.73 0 14 0z" fill="#2E7D32" stroke="#FFFFFF" stroke-width="1.5"/>
    <circle cx="14" cy="13" r="6" fill="#FFFFFF" opacity="0.9"/>
    <path d="M14 8l-5 5h2v4h6v-4h2L14 8z" fill="#2E7D32"/>
  </svg>`;
  return L.divIcon({
    html: `<img src="data:image/svg+xml,${encodeURIComponent(svg.trim())}" width="28" height="36" class="shelter-icon" />`,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -36],
    className: '',
  });
}

const shelterIcon = createShelterIcon();

/**
 * Pans the map to follow the traveler position.
 * First render: setView with zoom. Subsequent: smooth panTo (preserves zoom).
 */
function MapFollower({ position }) {
  const map = useMap();
  const isFirstRef = useRef(true);

  useEffect(() => {
    if (!position) return;
    const latlng = [position.lat, position.lon];

    if (isFirstRef.current) {
      map.setView(latlng, 10);
      isFirstRef.current = false;
    } else {
      map.panTo(latlng, { animate: true, duration: 0.8 });
    }
  }, [position, map]);

  return null;
}

export default function WeatherMap({
  currentPosition,
  travelerHeading = 0,
  route,
  currentWaypointIndex = 0,
  dangerZone = null,
  alternateRoute,
  stormCells = [],
  shelters = [],
  initialCenter,
}) {
  const defaultCenter = initialCenter || [37.5, -84.3];

  return (
    <MapContainer
      center={defaultCenter}
      zoom={10}
      className="w-full h-full"
      zoomControl={true}
      style={{ width: '100%', height: '100%' }}
    >
      <TileLayer url={DARK_TILE_URL} attribution={DARK_TILE_ATTR} />
      <ScaleControl position="bottomleft" imperial={true} metric={false} />
      <MapFollower position={currentPosition} />

      {/* Route with completed/safe/danger segments */}
      <RouteLayer
        waypoints={route}
        currentWaypointIndex={currentWaypointIndex}
        dangerZone={dangerZone}
      />

      {/* Storm cells with predicted paths */}
      <StormCellLayer stormCells={stormCells} />

      {/* Alternate route */}
      {alternateRoute && alternateRoute.waypoints && (
        <Polyline
          positions={alternateRoute.waypoints.map(p => [p.lat, p.lon])}
          pathOptions={{
            color: '#2E7D32',
            weight: 4,
            opacity: 0.75,
            dashArray: '12, 8',
          }}
        >
          <Popup>
            <div style={{ color: '#e6edf3' }}>
              <strong style={{ color: '#66BB6A' }}>Alternate Route</strong><br />
              <span style={{ fontSize: 12 }}>
                {alternateRoute.distanceMiles ? `${alternateRoute.distanceMiles} mi` : ''}
                {alternateRoute.timeMinutes ? ` / ~${alternateRoute.timeMinutes} min` : ''}
                {alternateRoute.description || ''}
              </span>
            </div>
          </Popup>
        </Polyline>
      )}

      {/* Shelter markers */}
      {shelters.filter(s => (s.lat || s.latitude) && (s.lon || s.longitude)).map((s, i) => (
        <Marker
          key={`shelter-${i}`}
          position={[s.lat || s.latitude, s.lon || s.longitude]}
          icon={shelterIcon}
        >
          <Popup>
            <div style={{ color: '#e6edf3', minWidth: 140 }}>
              <strong style={{ color: '#66BB6A' }}>{s.name}</strong><br />
              <span style={{ fontSize: 12 }}>
                {s.distanceMiles?.toFixed?.(1) || s.distanceMiles} mi
                {s.exitNumber ? ` | Exit ${s.exitNumber}` : ''}
              </span>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Traveler marker with animated arrow */}
      <TravelerMarker position={currentPosition} heading={travelerHeading} />
    </MapContainer>
  );
}
