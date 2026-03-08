import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useMutation } from '@apollo/client';
import { START_TRIP, UPDATE_POSITION, END_TRIP } from '../graphql/queries';
import { fetchRoute } from '../utils/routing';
import CORRIDORS from '../simulation/corridors';

/* ── Geo helpers ── */

function toRad(deg) { return deg * Math.PI / 180; }

function haversineDistance(a, b) {
  const R = 3958.8; // miles
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const sin2 = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(sin2), Math.sqrt(1 - sin2));
}

function computeHeading(from, to) {
  const dLon = toRad(to.lon - from.lon);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

function interpolate(a, b, fraction) {
  return {
    lat: a.lat + (b.lat - a.lat) * fraction,
    lon: a.lon + (b.lon - a.lon) * fraction,
  };
}

/* ── Tier color mapping (matches backend AlertTier enum) ── */
export const TIER_COLORS = {
  MONITORING:       '#22C55E',
  ADVISORY:         '#EAB308',
  ACTION_REQUIRED:  '#F97316',
  IMMEDIATE_DANGER: '#DC2626',
};

/* ── NWS alert types we care about ── */
const SEVERE_EVENTS = [
  'Tornado Warning',
  'Severe Thunderstorm Warning',
  'Flash Flood Warning',
  'Hurricane Warning',
  'Winter Storm Warning',
  'Blizzard Warning',
];

const MAX_ACTIVE = 20;
const MAX_WEATHER_TRIPS = 16;
const AUTO_START_COUNT = 4;
const NWS_POLL_MS = 2 * 60 * 1000; // 2 minutes

let nextId = 1;

/**
 * Core simulation hook that manages multiple virtual travelers.
 * Auto-starts corridor trips, rotates on completion, polls NWS for severe weather.
 */
export default function useSimulationEngine() {
  const [travelers, setTravelers] = useState([]);
  const [completedTrips, setCompletedTrips] = useState([]);
  const [nwsAlerts, setNwsAlerts] = useState([]);
  const [autoMode, setAutoMode] = useState(true);

  const travelersRef = useRef([]);
  const tickRef = useRef(null);
  const pollRef = useRef(null);
  const nwsPollRef = useRef(null);
  const mountedRef = useRef(true);
  const corridorIndexRef = useRef(0);
  const seenAlertIdsRef = useRef(new Set());
  const weatherTripCountRef = useRef(0);
  const autoStartedRef = useRef(false);

  const [startTrip] = useMutation(START_TRIP);
  const [updatePosition] = useMutation(UPDATE_POSITION);
  const [endTripMut] = useMutation(END_TRIP);

  // Keep ref in sync
  useEffect(() => { travelersRef.current = travelers; }, [travelers]);

  /* ── Pick next corridor (round-robin, skip in-use) ── */
  const pickNextCorridor = useCallback(() => {
    const activeLabels = new Set(travelersRef.current.map(t => t.corridorLabel));
    for (let i = 0; i < CORRIDORS.length; i++) {
      const idx = (corridorIndexRef.current + i) % CORRIDORS.length;
      if (!activeLabels.has(CORRIDORS[idx].label)) {
        corridorIndexRef.current = (idx + 1) % CORRIDORS.length;
        return CORRIDORS[idx];
      }
    }
    // All in use — just pick next
    const idx = corridorIndexRef.current % CORRIDORS.length;
    corridorIndexRef.current = (idx + 1) % CORRIDORS.length;
    return CORRIDORS[idx];
  }, []);

  /* ── Add a traveler ── */
  const addTraveler = useCallback(async (from, to, name, speedMph = 65, source = 'manual', corridorLabel = null) => {
    if (travelersRef.current.length >= MAX_ACTIVE) return;

    const id = nextId++;
    const placeholder = {
      id, name, status: 'loading', sessionId: null,
      route: [], waypointIndex: 0,
      position: from, heading: 0, speedMph,
      riskData: null, elapsed: 0, from, to,
      source, // 'auto' | 'weather' | 'manual'
      corridorLabel,
    };
    setTravelers(prev => [...prev, placeholder]);

    try {
      // Fetch OSRM route
      const routeData = await fetchRoute(from, to);
      const waypoints = routeData.waypoints;

      // Start backend session
      let sessionId = null;
      try {
        const { data } = await startTrip({
          variables: { fromLat: from.lat, fromLon: from.lon, toLat: to.lat, toLon: to.lon },
        });
        sessionId = data?.startTrip?.sessionId || null;
      } catch { /* backend may be offline */ }

      if (!mountedRef.current) return;

      setTravelers(prev => prev.map(t =>
        t.id === id ? {
          ...t, status: 'running', sessionId,
          route: waypoints, position: waypoints[0],
          heading: waypoints.length > 1 ? computeHeading(waypoints[0], waypoints[1]) : 0,
        } : t
      ));
    } catch {
      // Fallback: straight-line route
      if (!mountedRef.current) return;
      const steps = 100;
      const waypoints = [];
      for (let i = 0; i <= steps; i++) {
        const frac = i / steps;
        waypoints.push({ lat: from.lat + (to.lat - from.lat) * frac, lon: from.lon + (to.lon - from.lon) * frac });
      }
      setTravelers(prev => prev.map(t =>
        t.id === id ? { ...t, status: 'running', route: waypoints, position: waypoints[0] } : t
      ));
    }
  }, [startTrip]);

  /* ── Remove a traveler ── */
  const removeTraveler = useCallback(async (id) => {
    const t = travelersRef.current.find(t => t.id === id);
    if (t?.sessionId) {
      try { await endTripMut({ variables: { sessionId: t.sessionId } }); } catch { /* ok */ }
    }
    if (t?.source === 'weather') weatherTripCountRef.current = Math.max(0, weatherTripCountRef.current - 1);
    setTravelers(prev => prev.filter(t => t.id !== id));
  }, [endTripMut]);

  /* ── Pause / Resume ── */
  const pauseTraveler = useCallback((id) => {
    setTravelers(prev => prev.map(t =>
      t.id === id && t.status === 'running' ? { ...t, status: 'paused' } : t
    ));
  }, []);

  const resumeTraveler = useCallback((id) => {
    setTravelers(prev => prev.map(t =>
      t.id === id && t.status === 'paused' ? { ...t, status: 'running' } : t
    ));
  }, []);

  const pauseAll = useCallback(() => {
    setTravelers(prev => prev.map(t =>
      t.status === 'running' ? { ...t, status: 'paused' } : t
    ));
  }, []);

  const resumeAll = useCallback(() => {
    setTravelers(prev => prev.map(t =>
      t.status === 'paused' ? { ...t, status: 'running' } : t
    ));
  }, []);

  /* ── End all trips ── */
  const endAll = useCallback(async () => {
    setAutoMode(false);
    const active = travelersRef.current.filter(t => t.sessionId);
    await Promise.allSettled(
      active.map(t => endTripMut({ variables: { sessionId: t.sessionId } }).catch(() => {}))
    );
    // Move all to completed
    setTravelers(prev => {
      const now = prev.map(t => ({ ...t, status: 'completed' }));
      setCompletedTrips(old => [...old, ...now]);
      return [];
    });
    weatherTripCountRef.current = 0;
  }, [endTripMut]);

  /* ── Handle trip completion (move to completed, auto-rotate) ── */
  const handleTripCompleted = useCallback(async (completedTraveler) => {
    // End backend session
    if (completedTraveler.sessionId) {
      try { await endTripMut({ variables: { sessionId: completedTraveler.sessionId } }); } catch { /* ok */ }
    }

    if (completedTraveler.source === 'weather') {
      weatherTripCountRef.current = Math.max(0, weatherTripCountRef.current - 1);
    }

    // Move to completed list and remove from active
    setCompletedTrips(prev => [...prev, completedTraveler]);
    setTravelers(prev => prev.filter(t => t.id !== completedTraveler.id));

    // Auto-rotate: start a new corridor trip if autoMode is on and this was a corridor trip
    if (autoMode && (completedTraveler.source === 'auto')) {
      const corridor = pickNextCorridor();
      // Small delay to avoid overwhelming
      setTimeout(() => {
        if (mountedRef.current) {
          addTraveler(corridor.from, corridor.to, corridor.label, corridor.defaultSpeedMph, 'auto', corridor.label);
        }
      }, 1000);
    }
  }, [endTripMut, autoMode, pickNextCorridor, addTraveler]);

  /* ── Tick loop (1s): advance positions, detect completions ── */
  useEffect(() => {
    tickRef.current = setInterval(() => {
      setTravelers(prev => {
        const updated = [];
        const newlyCompleted = [];

        for (const t of prev) {
          if (t.status !== 'running' || !t.route || t.route.length < 2) {
            updated.push(t);
            continue;
          }

          const distPerTick = t.speedMph / 3600; // miles per second
          let remaining = distPerTick;
          let idx = t.waypointIndex;
          let pos = t.position;

          while (remaining > 0 && idx < t.route.length - 1) {
            const next = t.route[idx + 1];
            const segDist = haversineDistance(pos, next);

            if (segDist <= remaining) {
              remaining -= segDist;
              pos = next;
              idx++;
            } else {
              const fraction = remaining / segDist;
              pos = interpolate(pos, next, fraction);
              remaining = 0;
            }
          }

          const heading = idx < t.route.length - 1
            ? computeHeading(pos, t.route[idx + 1])
            : t.heading;

          const completed = idx >= t.route.length - 1;

          if (completed) {
            newlyCompleted.push({ ...t, position: pos, waypointIndex: idx, heading, elapsed: t.elapsed + 1, status: 'completed' });
          } else {
            updated.push({ ...t, position: pos, waypointIndex: idx, heading, elapsed: t.elapsed + 1 });
          }
        }

        // Handle completions asynchronously (outside setState)
        if (newlyCompleted.length > 0) {
          setTimeout(() => {
            newlyCompleted.forEach(t => handleTripCompleted(t));
          }, 0);
        }

        return updated;
      });
    }, 1000);

    return () => clearInterval(tickRef.current);
  }, [handleTripCompleted]);

  /* ── Poll loop (5s): update backend with positions, get risk data ── */
  useEffect(() => {
    let pollIndex = 0;

    pollRef.current = setInterval(async () => {
      const current = travelersRef.current.filter(
        t => t.status === 'running' && t.sessionId
      );
      if (current.length === 0) return;

      // Stagger: process ~2 travelers per tick
      const batchSize = 2;
      const start = pollIndex % current.length;
      const batch = [];
      for (let i = 0; i < Math.min(batchSize, current.length); i++) {
        batch.push(current[(start + i) % current.length]);
      }
      pollIndex += batchSize;

      const results = await Promise.allSettled(
        batch.map(t =>
          updatePosition({
            variables: {
              sessionId: t.sessionId,
              lat: t.position.lat,
              lon: t.position.lon,
              heading: t.heading,
              speedMph: t.speedMph,
            },
          })
        )
      );

      if (!mountedRef.current) return;

      setTravelers(prev => {
        const updated = [...prev];
        batch.forEach((t, i) => {
          const result = results[i];
          if (result.status !== 'fulfilled') return;
          const r = result.value?.data?.updatePosition;
          if (!r) return;
          const idx = updated.findIndex(u => u.id === t.id);
          if (idx === -1) return;
          updated[idx] = {
            ...updated[idx],
            riskData: {
              riskScore: r.overallScore / 100,
              tier: r.tier,
              alertMessage: r.alertMessage,
              recommendedAction: r.recommendedAction,
              hazardSpecificGuidance: r.hazardSpecificGuidance,
              timeToIntersectionMinutes: r.timeToIntersectionMinutes,
              hazardType: r.hazardType,
            },
          };
        });
        return updated;
      });
    }, 5000);

    return () => clearInterval(pollRef.current);
  }, [updatePosition]);

  /* ── NWS weather scan ── */
  const scanNws = useCallback(async () => {
    try {
      const resp = await fetch('https://api.weather.gov/alerts/active', {
        headers: { 'User-Agent': 'WeatherWise/1.0 (weatherwise-framework)' },
      });
      if (!resp.ok) return;
      const data = await resp.json();
      const features = data.features || [];

      const severe = features.filter(f => {
        const event = f.properties?.event;
        return SEVERE_EVENTS.includes(event);
      });

      setNwsAlerts(severe.map(f => ({
        id: f.properties.id,
        event: f.properties.event,
        headline: f.properties.headline,
        areaDesc: f.properties.areaDesc,
      })));

      // Spawn weather trips for new alerts
      for (const f of severe) {
        const alertId = f.properties.id;
        if (seenAlertIdsRef.current.has(alertId)) continue;
        if (weatherTripCountRef.current >= MAX_WEATHER_TRIPS) break;
        if (travelersRef.current.length >= MAX_ACTIVE) break;

        // Get centroid from polygon or use affectedZones fallback
        let centroid = null;
        const geom = f.geometry;
        if (geom && geom.type === 'Polygon' && geom.coordinates?.length > 0) {
          const coords = geom.coordinates[0];
          const avgLon = coords.reduce((s, c) => s + c[0], 0) / coords.length;
          const avgLat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
          centroid = { lat: avgLat, lon: avgLon };
        }

        if (!centroid) continue;

        seenAlertIdsRef.current.add(alertId);
        weatherTripCountRef.current++;

        // Create a short trip through the alert area (±0.3 degrees)
        const from = { lat: centroid.lat - 0.3, lon: centroid.lon - 0.2 };
        const to = { lat: centroid.lat + 0.3, lon: centroid.lon + 0.2 };
        const name = `WX: ${f.properties.event.replace(' Warning', '')}`;

        addTraveler(from, to, name, 60, 'weather', null);
      }
    } catch (err) {
      console.warn('NWS scan failed:', err);
    }
  }, [addTraveler]);

  /* ── Auto-start on mount ── */
  useEffect(() => {
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;

    // Stagger 4 corridor trips with 500ms delay between each
    for (let i = 0; i < AUTO_START_COUNT; i++) {
      setTimeout(() => {
        if (!mountedRef.current) return;
        const corridor = pickNextCorridor();
        addTraveler(corridor.from, corridor.to, corridor.label, corridor.defaultSpeedMph, 'auto', corridor.label);
      }, i * 500);
    }

    // Initial NWS scan after corridors start
    setTimeout(() => {
      if (mountedRef.current) scanNws();
    }, 3000);
  }, [pickNextCorridor, addTraveler, scanNws]);

  /* ── NWS poll loop (2 min) ── */
  useEffect(() => {
    nwsPollRef.current = setInterval(() => {
      if (autoMode) scanNws();
    }, NWS_POLL_MS);

    return () => clearInterval(nwsPollRef.current);
  }, [autoMode, scanNws]);

  /* ── Aggregate stats (computed live) ── */
  const stats = useMemo(() => {
    const active = travelers.filter(t => t.status === 'running' || t.status === 'paused' || t.status === 'loading');
    const running = travelers.filter(t => t.status === 'running');
    const weatherTrips = travelers.filter(t => t.source === 'weather');
    const autoTrips = travelers.filter(t => t.source === 'auto');

    const withRisk = travelers.filter(t => t.riskData?.riskScore != null);
    const meanRisk = withRisk.length > 0
      ? withRisk.reduce((s, t) => s + t.riskData.riskScore, 0) / withRisk.length
      : 0;
    const maxRisk = withRisk.length > 0
      ? Math.max(...withRisk.map(t => t.riskData.riskScore))
      : 0;

    // Tier distribution
    const tiers = { MONITORING: 0, ADVISORY: 0, ACTION_REQUIRED: 0, IMMEDIATE_DANGER: 0 };
    travelers.forEach(t => {
      const tier = t.riskData?.tier || 'MONITORING';
      if (tiers[tier] !== undefined) tiers[tier]++;
    });

    return {
      activeCount: active.length,
      runningCount: running.length,
      completedCount: completedTrips.length,
      weatherTripCount: weatherTrips.length,
      autoTripCount: autoTrips.length,
      meanRisk,
      maxRisk,
      tiers,
      nwsAlertCount: nwsAlerts.length,
    };
  }, [travelers, completedTrips, nwsAlerts]);

  /* ── Cleanup on unmount ── */
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearInterval(nwsPollRef.current);
      travelersRef.current
        .filter(t => t.sessionId && t.status !== 'completed')
        .forEach(t => {
          endTripMut({ variables: { sessionId: t.sessionId } }).catch(() => {});
        });
    };
  }, [endTripMut]);

  return {
    travelers,
    completedTrips,
    nwsAlerts,
    stats,
    autoMode,
    setAutoMode,
    addTraveler,
    removeTraveler,
    pauseTraveler,
    resumeTraveler,
    pauseAll,
    resumeAll,
    endAll,
    scanNws,
  };
}
