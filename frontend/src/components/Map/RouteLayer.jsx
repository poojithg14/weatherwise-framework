import { Polyline } from 'react-leaflet';
import { useMemo } from 'react';

export default function RouteLayer({ waypoints, currentWaypointIndex, dangerZone }) {
  // dangerZone = { startIndex, endIndex } or null — indices where storm crosses route

  const { completedPath, safePath, dangerPath } = useMemo(() => {
    if (!waypoints || waypoints.length < 2) return { completedPath: [], safePath: [], dangerPath: [] };

    const toLatLng = (wp) => [wp.lat, wp.lon];
    const idx = currentWaypointIndex || 0;

    // Completed: start to current position
    const completed = waypoints.slice(0, idx + 1).map(toLatLng);

    // Remaining waypoints
    const remaining = waypoints.slice(idx);

    if (dangerZone && dangerZone.startIndex != null && dangerZone.endIndex != null) {
      // Adjust danger indices relative to remaining array
      const relStart = Math.max(0, dangerZone.startIndex - idx);
      const relEnd = Math.min(remaining.length - 1, dangerZone.endIndex - idx);

      if (relStart < remaining.length && relEnd > 0) {
        const safe1 = remaining.slice(0, relStart + 1).map(toLatLng);
        const danger = remaining.slice(Math.max(0, relStart), relEnd + 1).map(toLatLng);
        const safe2 = remaining.slice(relEnd).map(toLatLng);

        return {
          completedPath: completed,
          safePath: safe1.length > 1 || safe2.length > 1 ? [...safe1, ...safe2] : remaining.map(toLatLng),
          dangerPath: danger
        };
      }
    }

    return {
      completedPath: completed,
      safePath: remaining.map(toLatLng),
      dangerPath: []
    };
  }, [waypoints, currentWaypointIndex, dangerZone]);

  return (
    <>
      {/* Completed path - gray, thin, dashed */}
      {completedPath.length > 1 && (
        <Polyline
          positions={completedPath}
          pathOptions={{ color: '#6B7280', weight: 3, opacity: 0.5, dashArray: '5,10' }}
        />
      )}

      {/* Remaining safe path - blue */}
      {safePath.length > 1 && (
        <Polyline
          positions={safePath}
          pathOptions={{ color: '#3B82F6', weight: 5, opacity: 0.9 }}
        />
      )}

      {/* Dangerous path - red, thick */}
      {dangerPath.length > 1 && (
        <Polyline
          positions={dangerPath}
          pathOptions={{ color: '#EF4444', weight: 7, opacity: 1.0 }}
          className="danger-route-pulse"
        />
      )}
    </>
  );
}
