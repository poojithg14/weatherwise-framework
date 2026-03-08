import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  ScaleControl,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import useSimulationEngine, { TIER_COLORS } from '../hooks/useSimulationEngine';
import { useAudioAlerts } from '../hooks/useAudioAlerts';
import SimulationSetupPanel from '../components/simulation/SimulationSetupPanel';
import TravelerListPanel from '../components/simulation/TravelerListPanel';
import SimulationControls from '../components/simulation/SimulationControls';
import AlertBanner from '../components/AlertBanner';
import DangerOverlay from '../components/DangerOverlay';
import StormCellLayer from '../components/Map/StormCellLayer';

const DARK_TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const DARK_TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';

/* ── Tier priority for determining highest-risk traveler ── */
const TIER_PRIORITY = { MONITORING: 0, ADVISORY: 1, ACTION_REQUIRED: 2, IMMEDIATE_DANGER: 3 };

/* ── Traveler arrow icon factory ── */
function createTravelerIcon(heading, color) {
  return L.divIcon({
    className: '',
    html: `
      <div style="position: relative; width: 32px; height: 32px;">
        <div style="position: absolute; top: 8px; left: 8px; width: 16px; height: 16px; border-radius: 50%; background: ${color}; opacity: 0.3; animation: travelerPulse 2s ease-out infinite;"></div>
        <svg width="32" height="32" viewBox="0 0 40 40" style="transform: rotate(${heading || 0}deg); transform-origin: center;">
          <polygon points="20,4 32,36 20,28 8,36" fill="${color}" stroke="#000" stroke-width="1.5"/>
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

/* ── Map panner ── */
function MapPanner({ target }) {
  const map = useMap();
  const prevRef = useRef(null);

  if (target && (prevRef.current !== target)) {
    prevRef.current = target;
    map.panTo([target.lat, target.lon], { animate: true, duration: 0.5 });
  }

  return null;
}

/* ── Route colors for multi-traveler disambiguation ── */
const ROUTE_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#06B6D4',
];

export default function SimulatePage() {
  const {
    travelers, completedTrips, nwsAlerts, stats, autoMode, setAutoMode,
    addTraveler, removeTraveler,
    pauseTraveler, resumeTraveler, pauseAll, resumeAll, endAll,
    scanNws,
  } = useSimulationEngine();

  const { playAlert, stopAlerts } = useAudioAlerts();
  const playAlertRef = useRef(playAlert);
  useEffect(() => { playAlertRef.current = playAlert; }, [playAlert]);

  const [setupCollapsed, setSetupCollapsed] = useState(false);
  const [focusTarget, setFocusTarget] = useState(null);

  // Find highest-risk traveler for alert banner + danger overlay
  const highestRiskTraveler = useMemo(() => {
    let best = null;
    let bestPriority = -1;
    for (const t of travelers) {
      if (!t.riskData) continue;
      const tier = t.riskData.tier || 'MONITORING';
      const priority = TIER_PRIORITY[tier] ?? 0;
      if (priority > bestPriority || (priority === bestPriority && (t.riskData.riskScore ?? 0) > (best?.riskData?.riskScore ?? 0))) {
        best = t;
        bestPriority = priority;
      }
    }
    return best;
  }, [travelers]);

  const highestTier = highestRiskTraveler?.riskData?.tier || null;
  const isDanger = highestTier === 'IMMEDIATE_DANGER';

  // Trigger audio alerts when the highest tier escalates
  const prevHighestTierRef = useRef(null);
  useEffect(() => {
    if (!highestTier || highestTier === 'MONITORING') {
      if (prevHighestTierRef.current && prevHighestTierRef.current !== 'MONITORING') {
        stopAlerts();
      }
      prevHighestTierRef.current = highestTier;
      return;
    }

    if (highestTier !== prevHighestTierRef.current) {
      const msg = highestRiskTraveler?.riskData?.alertMessage;
      const name = highestRiskTraveler?.name || 'Traveler';
      playAlertRef.current(highestTier, `${name}: ${msg || 'Weather hazard detected'}`);
    }
    prevHighestTierRef.current = highestTier;
  }, [highestTier, highestRiskTraveler, stopAlerts]);

  // Cleanup audio on unmount
  useEffect(() => { return () => stopAlerts(); }, [stopAlerts]);

  const handleFocus = useCallback((traveler) => {
    if (traveler.position) {
      setFocusTarget({ ...traveler.position, _ts: Date.now() });
    }
  }, []);

  const handleEndAll = useCallback(async () => {
    stopAlerts();
    await endAll();
  }, [endAll, stopAlerts]);

  const handleToggleAuto = useCallback(() => {
    setAutoMode(prev => !prev);
  }, [setAutoMode]);

  // Gather all storm cells from all travelers' risk data
  const allStormCells = useMemo(() => {
    const cells = [];
    travelers.forEach(t => {
      if (t.riskData?.stormCells) cells.push(...t.riskData.stormCells);
    });
    return cells;
  }, [travelers]);

  // Default to US-wide view (continental US center)
  const mapCenter = [39.0, -98.0];

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-ww-dark">
      {/* Danger overlay — pulsing red border when any traveler is in IMMEDIATE_DANGER */}
      <DangerOverlay
        active={isDanger}
        message={highestRiskTraveler?.riskData?.alertMessage || 'SEVERE WEATHER - TAKE ACTION'}
      />

      {/* Full-screen map */}
      <div className="absolute inset-0 z-0">
        <MapContainer
          center={mapCenter}
          zoom={5}
          className="w-full h-full"
          zoomControl={true}
          style={{ width: '100%', height: '100%' }}
        >
          <TileLayer url={DARK_TILE_URL} attribution={DARK_TILE_ATTR} />
          <ScaleControl position="bottomleft" imperial={true} metric={false} />
          <MapPanner target={focusTarget} />

          {/* Storm cells from NWS data */}
          <StormCellLayer stormCells={allStormCells} />

          {/* Route polylines for each traveler */}
          {travelers.map((t, idx) => {
            if (!t.route || t.route.length < 2) return null;
            const tier = t.riskData?.tier || 'MONITORING';
            const routeColor = (tier === 'IMMEDIATE_DANGER' || tier === 'ACTION_REQUIRED')
              ? TIER_COLORS[tier]
              : ROUTE_COLORS[idx % ROUTE_COLORS.length];
            const isHighRisk = tier === 'IMMEDIATE_DANGER' || tier === 'ACTION_REQUIRED';
            return (
              <Polyline
                key={`route-${t.id}`}
                positions={t.route.map(wp => [wp.lat, wp.lon])}
                pathOptions={{
                  color: routeColor,
                  weight: isHighRisk ? 5 : 3,
                  opacity: t.status === 'completed' ? 0.3 : (isHighRisk ? 0.9 : 0.6),
                  dashArray: t.status === 'paused' ? '8,6' : '',
                  className: tier === 'IMMEDIATE_DANGER' ? 'danger-route-pulse' : '',
                }}
              />
            );
          })}

          {/* Traveler markers */}
          {travelers.map((t, idx) => {
            if (!t.position) return null;
            const tier = t.riskData?.tier || 'MONITORING';
            const color = TIER_COLORS[tier] || TIER_COLORS.MONITORING;
            const icon = createTravelerIcon(t.heading, color);
            return (
              <Marker
                key={`traveler-${t.id}`}
                position={[t.position.lat, t.position.lon]}
                icon={icon}
                zIndexOffset={1000 + idx}
              >
                <Popup>
                  <div style={{ color: '#e6edf3', minWidth: 160 }}>
                    <strong style={{ color }}>{t.name}</strong>
                    <div style={{ fontSize: 12, marginTop: 4 }}>
                      <div>Status: {t.status} ({t.source})</div>
                      {t.riskData && (
                        <>
                          <div>Risk: {(t.riskData.riskScore * 100).toFixed(0)}% ({t.riskData.tier})</div>
                          {t.riskData.hazardType && (
                            <div style={{ fontWeight: 'bold', color: TIER_COLORS[tier] }}>{t.riskData.hazardType}</div>
                          )}
                          {t.riskData.alertMessage && (
                            <div style={{ marginTop: 4, fontSize: 11, opacity: 0.8 }}>{t.riskData.alertMessage}</div>
                          )}
                          {t.riskData.recommendedAction && (
                            <div style={{ marginTop: 2, fontSize: 11, color: '#F59E0B' }}>{t.riskData.recommendedAction}</div>
                          )}
                        </>
                      )}
                      <div>Speed: {t.speedMph} mph</div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* Top controls bar */}
      <SimulationControls
        travelers={travelers}
        onPauseAll={pauseAll}
        onResumeAll={resumeAll}
        onEndAll={handleEndAll}
        stats={stats}
        autoMode={autoMode}
      />

      {/* Alert banner — shows highest-risk traveler's alert */}
      {highestRiskTraveler?.riskData && highestTier !== 'MONITORING' && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[800] w-[28rem] max-w-[90vw]">
          <AlertBanner
            tier={highestRiskTraveler.riskData.tier}
            message={`${highestRiskTraveler.name}: ${highestRiskTraveler.riskData.alertMessage || 'Weather hazard detected'}`}
            action={highestRiskTraveler.riskData.recommendedAction}
            countdown={highestRiskTraveler.riskData.timeToIntersectionMinutes}
          />
        </div>
      )}

      {/* Left panel: setup */}
      <SimulationSetupPanel
        onAddTraveler={addTraveler}
        travelerCount={travelers.length}
        collapsed={setupCollapsed}
        onToggle={() => setSetupCollapsed(prev => !prev)}
        autoMode={autoMode}
        onToggleAuto={handleToggleAuto}
        onScanNws={scanNws}
        nwsAlertCount={nwsAlerts.length}
        activeTravelers={travelers}
      />

      {/* Right panel: traveler list */}
      <TravelerListPanel
        travelers={travelers}
        completedCount={completedTrips.length}
        onPause={pauseTraveler}
        onResume={resumeTraveler}
        onRemove={removeTraveler}
        onFocus={handleFocus}
      />
    </div>
  );
}
