const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';

/**
 * Fetch multiple road routes from OSRM between two points.
 * Returns an array of route objects, each with waypoints, distance, and duration.
 * Requests up to 3 alternative routes.
 */
export async function fetchRoutes(from, to) {
  try {
    const coords = `${from.lon},${from.lat};${to.lon},${to.lat}`;
    const url = `${OSRM_URL}/${coords}?overview=full&geometries=geojson&alternatives=3`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OSRM returned ${res.status}`);
    const data = await res.json();

    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      return data.routes.map((route, idx) => ({
        id: idx,
        waypoints: route.geometry.coordinates.map(([lon, lat]) => ({ lat, lon })),
        distanceMiles: parseFloat((route.distance / 1609.34).toFixed(1)),
        durationMinutes: Math.round(route.duration / 60),
        label: idx === 0 ? 'Fastest Route' : `Alternative ${idx}`,
      }));
    }
  } catch {
    // OSRM unavailable
  }

  // Straight-line fallback (single route)
  const steps = 100;
  const waypoints = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    waypoints.push({
      lat: from.lat + (to.lat - from.lat) * t,
      lon: from.lon + (to.lon - from.lon) * t,
    });
  }
  const dLat = to.lat - from.lat;
  const dLon = to.lon - from.lon;
  const distMiles = parseFloat((Math.sqrt(dLat * dLat + dLon * dLon) * 69).toFixed(1));

  return [{
    id: 0,
    waypoints,
    distanceMiles: distMiles,
    durationMinutes: Math.round(distMiles / 65 * 60),
    label: 'Direct Route',
  }];
}

/**
 * Fetch a single route (convenience wrapper, used in demo mode).
 */
export async function fetchRoute(from, to) {
  const routes = await fetchRoutes(from, to);
  return routes[0];
}
