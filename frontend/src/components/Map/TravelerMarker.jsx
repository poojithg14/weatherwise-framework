import { Marker } from 'react-leaflet';
import L from 'leaflet';
import { useMemo } from 'react';

export default function TravelerMarker({ position, heading }) {
  // Create custom arrow icon that rotates with heading
  const icon = useMemo(() => {
    return L.divIcon({
      className: 'traveler-marker',
      html: `
        <div style="position: relative; width: 40px; height: 40px;">
          <div class="traveler-pulse-ring" style="position: absolute; top: 10px; left: 10px;"></div>
          <svg width="40" height="40" viewBox="0 0 40 40" style="transform: rotate(${heading || 0}deg); transform-origin: center;">
            <polygon points="20,4 32,36 20,28 8,36" fill="#3B82F6" stroke="#1D4ED8" stroke-width="2"/>
          </svg>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
  }, [heading]);

  if (!position) return null;

  return (
    <Marker
      position={[position.lat, position.lon]}
      icon={icon}
      zIndexOffset={1000}
    />
  );
}
