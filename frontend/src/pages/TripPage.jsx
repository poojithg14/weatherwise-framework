import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation } from '@apollo/client';
import WeatherMap from '../components/WeatherMap';
import AlertBanner from '../components/AlertBanner';
import DangerOverlay from '../components/DangerOverlay';
import RiskGauge from '../components/RiskGauge';
import InfoPanel from '../components/InfoPanel';
import { useTripSimulation } from '../hooks/useTripSimulation';
import { useAudioAlerts } from '../hooks/useAudioAlerts';
import { fetchRoute } from '../utils/routing';
import { START_TRIP, UPDATE_POSITION, END_TRIP } from '../graphql/queries';

export default function TripPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { mode, scenario, origin, destination, preloadedRoute } = location.state || {};
  const isDemo = mode === 'demo';

  // ── Shared state ──
  const [routeWaypoints, setRouteWaypoints] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const { playAlert, stopAlerts } = useAudioAlerts();

  // ── Real-mode state ──
  const [sessionId, setSessionId] = useState(null);
  const [realTripData, setRealTripData] = useState(null);
  const [realTravelerPos, setRealTravelerPos] = useState(null);
  const [realElapsedSeconds, setRealElapsedSeconds] = useState(0);
  const [realHeading, setRealHeading] = useState(0);

  const [startTrip] = useMutation(START_TRIP);
  const [updatePosition] = useMutation(UPDATE_POSITION);
  const [endTrip] = useMutation(END_TRIP);

  const tripStartTimeRef = useRef(null);
  const geoWatchIdRef = useRef(null);
  const gpsPosRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const realTimerRef = useRef(null);
  const sessionIdRef = useRef(null);
  const playAlertRef = useRef(playAlert);
  const originRef = useRef(origin);

  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { playAlertRef.current = playAlert; }, [playAlert]);

  // ── Log mode on mount ──
  useEffect(() => {
    console.log("MODE:", isDemo ? "DEMO" : "REAL");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── DEMO MODE: simulation hook ──
  const sim = useTripSimulation(
    isDemo ? routeWaypoints : null,
    isDemo ? scenario?.timeline : null,
    isDemo
  );

  console.log('TripPage rendered, position:', sim.currentPosition, 'elapsed:', sim.elapsedMinutes, 'waypoints:', routeWaypoints.length);

  // Play audio alerts when demo tier changes
  useEffect(() => {
    if (isDemo && sim.isSimulationRunning) {
      playAlert(sim.alertTier, sim.alertMessage);
    }
  }, [isDemo, sim.alertTier, sim.isSimulationRunning, playAlert]);

  // ── Initialize trip (runs once on mount) ──
  useEffect(() => {
    if (!mode) { navigate('/'); return; }

    if (isDemo && scenario) {
      console.log('TripPage: DEMO init, scenario:', scenario.name);

      if (scenario.routeWaypoints && scenario.routeWaypoints.length >= 2) {
        console.log('TripPage: Using scenario routeWaypoints:', scenario.routeWaypoints.length, 'points');
        setRouteWaypoints(scenario.routeWaypoints);
        const distMiles = estimateRouteDistance(scenario.routeWaypoints);
        setRouteInfo({ distance: Math.round(distMiles), duration: Math.round(distMiles / 65 * 60) });
      } else {
        console.log('TripPage: Fetching OSRM route for', scenario.route.from, '->', scenario.route.to);
        fetchRoute(scenario.route.from, scenario.route.to).then((result) => {
          console.log('TripPage: OSRM returned', result.waypoints.length, 'waypoints');
          setRouteWaypoints(result.waypoints);
          setRouteInfo({ distance: result.distanceMiles, duration: result.durationMinutes });
        });
      }
    } else if (mode === 'real' && origin && destination) {
      tripStartTimeRef.current = Date.now();
      setRealTravelerPos({ lat: origin.lat, lon: origin.lon });
      gpsPosRef.current = { lat: origin.lat, lon: origin.lon, heading: 0, speedMph: 0 };

      if (preloadedRoute?.waypoints) {
        setRouteWaypoints(preloadedRoute.waypoints);
        setRouteInfo({ distance: preloadedRoute.distanceMiles, duration: preloadedRoute.durationMinutes });
      }

      startTrip({
        variables: { fromLat: origin.lat, fromLon: origin.lon, toLat: destination.lat, toLon: destination.lon },
      }).then(({ data }) => {
        if (data?.startTrip) {
          setSessionId(data.startTrip.sessionId);
          if (!preloadedRoute) {
            const r = data.startTrip.route;
            if (r?.length > 1) { setRouteWaypoints(r); }
            else { fetchRoute(origin, destination).then(res => { setRouteWaypoints(res.waypoints); setRouteInfo({ distance: res.distanceMiles, duration: res.durationMinutes }); }); }
          }
        }
      }).catch(() => {
        if (!preloadedRoute) fetchRoute(origin, destination).then(res => { setRouteWaypoints(res.waypoints); setRouteInfo({ distance: res.distanceMiles, duration: res.durationMinutes }); });
      });
    }

    return () => { stopAlerts(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── REAL MODE: wall-clock timer ──
  useEffect(() => {
    if (mode !== 'real') return;
    if (!tripStartTimeRef.current) tripStartTimeRef.current = Date.now();
    realTimerRef.current = setInterval(() => {
      setRealElapsedSeconds(Math.floor((Date.now() - tripStartTimeRef.current) / 1000));
    }, 1000);
    return () => { if (realTimerRef.current) clearInterval(realTimerRef.current); };
  }, [mode]);

  // ── REAL MODE: GPS tracking ──
  useEffect(() => {
    if (mode !== 'real' || !navigator.geolocation) return;
    geoWatchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, heading: gh, speed } = pos.coords;
        let heading = (gh != null && !isNaN(gh) && gh >= 0) ? gh : 0;
        if (heading === 0 && gpsPosRef.current) heading = computeHeading(gpsPosRef.current, { lat: latitude, lon: longitude });
        gpsPosRef.current = { lat: latitude, lon: longitude, heading, speedMph: speed > 0 ? speed * 2.237 : 0 };
        setRealTravelerPos({ lat: latitude, lon: longitude });
        setRealHeading(heading);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
    return () => { if (geoWatchIdRef.current != null) navigator.geolocation.clearWatch(geoWatchIdRef.current); };
  }, [mode]);

  // ── REAL MODE: 10-sec backend polling ──
  useEffect(() => {
    if (mode !== 'real') return;
    pollIntervalRef.current = setInterval(async () => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      const pos = gpsPosRef.current || { lat: originRef.current?.lat || 0, lon: originRef.current?.lon || 0, heading: 0, speedMph: 0 };
      try {
        const { data } = await updatePosition({ variables: { sessionId: sid, lat: pos.lat, lon: pos.lon, heading: pos.heading, speedMph: pos.speedMph } });
        if (data?.updatePosition) {
          const r = data.updatePosition;
          setRealTripData({
            riskScore: r.overallScore / 100, tier: r.tier, alertMessage: r.alertMessage,
            recommendedAction: r.recommendedAction, stormCells: r.hazards || [],
            shelters: r.nearestShelters || [], alternateRoute: r.alternateRoute || null,
          });
          playAlertRef.current(r.tier, r.alertMessage);
        }
      } catch { /* backend unavailable */ }
    }, 10000);
    return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); };
  }, [mode, updatePosition]);

  // ── End trip ──
  const handleEndTrip = async () => {
    stopAlerts();
    if (geoWatchIdRef.current != null) navigator.geolocation.clearWatch(geoWatchIdRef.current);
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (realTimerRef.current) clearInterval(realTimerRef.current);

    if (sessionId) {
      try {
        const { data } = await endTrip({ variables: { sessionId } });
        navigate('/summary', { state: { summary: data?.endTrip, mode } });
        return;
      } catch { /* fallthrough */ }
    }

    navigate('/summary', {
      state: {
        summary: {
          totalDistanceMiles: routeInfo?.distance || (scenario ? 175 : 0),
          totalTimeMinutes: isDemo ? sim.elapsedMinutes : Math.floor(realElapsedSeconds / 60),
          maxRiskScore: isDemo ? sim.riskScore : (realTripData?.riskScore || 0),
          alertsReceived: scenario?.timeline?.filter(t => t.tier !== 'MONITORING').length || 0,
          actionsRecommended: scenario?.timeline?.filter(t => t.dangerZone != null).length || 0,
          scenarioName: scenario?.name,
        },
        mode,
      },
    });
  };

  // ── Derived display values ──
  const travelerPos = isDemo ? sim.currentPosition : realTravelerPos;
  const heading = isDemo ? sim.currentHeading : realHeading;
  const riskScore = isDemo ? sim.riskScore : (realTripData?.riskScore || 0);
  const alertTier = isDemo ? sim.alertTier : (realTripData?.tier || 'MONITORING');
  const alertMessage = isDemo ? sim.alertMessage : (realTripData?.alertMessage || '');
  const action = isDemo ? sim.recommendedAction : (realTripData?.recommendedAction || 'CONTINUE');
  const displayStormCells = isDemo ? sim.stormCells : (realTripData?.stormCells || []);
  const displayShelters = isDemo ? sim.shelters : (realTripData?.shelters || []);
  const altRoute = isDemo ? sim.alternateRoute : (realTripData?.alternateRoute || null);
  const dangerZone = isDemo ? sim.dangerZone : null;
  const currentWaypointIndex = isDemo ? sim.currentWaypointIndex : 0;

  const isDanger = alertTier === 'IMMEDIATE_DANGER';

  const elapsedDisplay = isDemo
    ? `${sim.elapsedMinutes} min`
    : `${Math.floor(realElapsedSeconds / 60)}:${String(realElapsedSeconds % 60).padStart(2, '0')}`;

  const countdownDisplay = isDemo && sim.countdown != null ? `Tornado in ${sim.countdown} min` : null;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-ww-dark" style={{ overflow: 'hidden' }}>
      {/* Full-screen map */}
      <div className="absolute inset-0 z-0">
        <WeatherMap
          currentPosition={travelerPos}
          travelerHeading={heading}
          route={routeWaypoints}
          currentWaypointIndex={currentWaypointIndex}
          dangerZone={dangerZone}
          alternateRoute={altRoute}
          stormCells={displayStormCells}
          shelters={displayShelters}
          initialCenter={
            scenario?.center ? [scenario.center.lat, scenario.center.lon]
            : origin ? [origin.lat, origin.lon]
            : [37.5, -84.3]
          }
        />
      </div>

      {/* Danger overlay */}
      <DangerOverlay active={isDanger} message={alertMessage} />

      {/* Mode badge — top-left */}
      <div className="absolute top-3 left-3 z-[600]">
        {isDemo ? (
          <div className="flex items-center gap-1.5 bg-orange-600/90 backdrop-blur-sm text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-lg">
            <span className="inline-block w-2 h-2 rounded-full bg-white animate-pulse" />
            DEMO
          </div>
        ) : (
          <div className="flex items-center gap-1.5 bg-green-700/90 backdrop-blur-sm text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-lg">
            <span className="inline-block w-2 h-2 rounded-full bg-white animate-pulse" />
            LIVE
          </div>
        )}
      </div>

      {/* Alert banner - top center, avoids sidebar */}
      <div className="absolute top-3 left-16 right-4 md:right-[310px] z-[500]">
        <AlertBanner
          tier={alertTier}
          message={alertMessage}
          action={action}
          countdown={isDemo ? sim.countdown : null}
          shelters={displayShelters}
          alternateRoute={altRoute}
          onAction={(act) => {
            console.log('User action:', act);
            // In demo: action is acknowledged visually in the banner
            // In real: would trigger backend reroute/navigation
          }}
        />
      </div>

      {/* Right sidebar panel */}
      <div className="absolute bottom-0 left-0 right-0 md:top-3 md:bottom-auto md:left-auto md:right-3 z-[500] w-full md:w-72 space-y-3 max-h-[40vh] md:max-h-none overflow-y-auto md:overflow-visible p-2 md:p-0">
        <RiskGauge score={riskScore} tier={alertTier} />
        <div className="bg-ww-surface/90 backdrop-blur-sm border border-ww-border rounded-xl p-4">
          <InfoPanel
            data={{ riskScore, tier: alertTier, alertMessage, recommendedAction: action, stormCells: displayStormCells, shelters: displayShelters, alternateRoute: altRoute }}
            elapsedMinutes={isDemo ? sim.elapsedMinutes : Math.floor(realElapsedSeconds / 60)}
          />
          {routeInfo && (
            <div className="mt-3 flex items-center justify-between text-sm border-t border-ww-border pt-3">
              <span className="text-gray-400">Route</span>
              <span className="text-white font-mono">{routeInfo.distance} mi / ~{routeInfo.duration} min</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-3">
        <div className="bg-ww-surface/90 backdrop-blur-sm border border-ww-border rounded-xl px-4 py-3 text-center">
          <div className="text-xs text-gray-400">{isDemo ? 'Simulation' : 'Elapsed'}</div>
          <div className="text-xl font-mono text-white">{elapsedDisplay}</div>
          {countdownDisplay && (
            <div className="text-[10px] text-red-400 font-bold mt-0.5">{countdownDisplay}</div>
          )}
        </div>
        <button
          onClick={handleEndTrip}
          className="bg-ww-red hover:bg-red-700 text-white font-bold px-6 py-3 rounded-xl transition-colors active:scale-95"
        >
          End Trip
        </button>
      </div>

      {/* Scenario info — bottom-left (demo only) */}
      {isDemo && (
        <div className="absolute bottom-4 left-4 z-[500]">
          <div className="bg-ww-surface/90 backdrop-blur-sm border border-ww-border rounded-lg px-3 py-2 text-xs text-gray-400">
            {scenario?.name || 'Scenario'}
          </div>
        </div>
      )}
    </div>
  );
}

// Estimate total route distance from waypoints using haversine
function estimateRouteDistance(waypoints) {
  let total = 0;
  for (let i = 1; i < waypoints.length; i++) {
    const dLat = waypoints[i].lat - waypoints[i-1].lat;
    const dLon = waypoints[i].lon - waypoints[i-1].lon;
    const R = 3959;
    const a = Math.sin(dLat * Math.PI / 360) ** 2 +
      Math.cos(waypoints[i-1].lat * Math.PI / 180) * Math.cos(waypoints[i].lat * Math.PI / 180) *
      Math.sin(dLon * Math.PI / 360) ** 2;
    total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return total;
}

function computeHeading(from, to) {
  const dLon = (to.lon - from.lon) * Math.PI / 180;
  const lat1 = from.lat * Math.PI / 180;
  const lat2 = to.lat * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}
