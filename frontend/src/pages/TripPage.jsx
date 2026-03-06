import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useSubscription } from '@apollo/client';
import WeatherMap from '../components/WeatherMap';
import AlertBanner from '../components/AlertBanner';
import DangerOverlay from '../components/DangerOverlay';
import RiskGauge from '../components/RiskGauge';
import InfoPanel from '../components/InfoPanel';
import ToastContainer from '../components/ToastContainer';
import { MapSkeleton, SidebarSkeleton } from '../components/LoadingSkeleton';
import { useAudioAlerts } from '../hooks/useAudioAlerts';
import { useToast } from '../hooks/useToast';
import { fetchRoute } from '../utils/routing';
import { START_TRIP, UPDATE_POSITION, END_TRIP, RISK_UPDATES_SUBSCRIPTION } from '../graphql/queries';

export default function TripPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { origin, destination, preloadedRoute } = location.state || {};

  // ── State ──
  const [routeWaypoints, setRouteWaypoints] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const { playAlert, stopAlerts } = useAudioAlerts();
  const { toasts, addToast, removeToast } = useToast();
  const [userAcceptedReroute, setUserAcceptedReroute] = useState(false);

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
  const mountedRef = useRef(true);

  // Throttled subscription position — updates every 10s
  const [subPos, setSubPos] = useState(null);
  useEffect(() => {
    const id = setInterval(() => {
      const pos = gpsPosRef.current;
      if (pos) setSubPos({ lat: pos.lat, lon: pos.lon, heading: pos.heading, speedMph: pos.speedMph });
    }, 10000);
    return () => clearInterval(id);
  }, []);

  // ── WebSocket subscription for real-time risk updates ──
  useSubscription(RISK_UPDATES_SUBSCRIPTION, {
    variables: {
      lat: subPos?.lat || origin?.lat || 0,
      lon: subPos?.lon || origin?.lon || 0,
      heading: subPos?.heading || 0,
      speedMph: subPos?.speedMph || 0,
    },
    skip: !subPos,
    onData: ({ data: { data } }) => {
      if (!mountedRef.current) return;
      if (data?.riskUpdates) {
        const r = data.riskUpdates;
        setRealTripData((prev) => ({
          ...prev,
          riskScore: r.overallScore / 100,
          tier: r.tier,
          alertMessage: r.alertMessage,
          recommendedAction: r.recommendedAction,
        }));
        playAlertRef.current(r.tier, r.alertMessage);
      }
    },
    onError: () => { /* WebSocket unavailable — polling fallback handles it */ },
  });

  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { playAlertRef.current = playAlert; }, [playAlert]);

  // Cleanup all resources on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (geoWatchIdRef.current != null) navigator.geolocation.clearWatch(geoWatchIdRef.current);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (realTimerRef.current) clearInterval(realTimerRef.current);
    };
  }, []);

  // ── Initialize trip (runs once on mount) ──
  useEffect(() => {
    if (!origin || !destination) { navigate('/'); return; }

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

    return () => { stopAlerts(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Wall-clock timer ──
  useEffect(() => {
    if (!tripStartTimeRef.current) tripStartTimeRef.current = Date.now();
    realTimerRef.current = setInterval(() => {
      setRealElapsedSeconds(Math.floor((Date.now() - tripStartTimeRef.current) / 1000));
    }, 1000);
    return () => { if (realTimerRef.current) clearInterval(realTimerRef.current); };
  }, []);

  // ── GPS tracking ──
  useEffect(() => {
    if (!navigator.geolocation) return;
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
  }, []);

  // ── 10-sec backend polling ──
  useEffect(() => {
    pollIntervalRef.current = setInterval(async () => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      const pos = gpsPosRef.current || { lat: originRef.current?.lat || 0, lon: originRef.current?.lon || 0, heading: 0, speedMph: 0 };
      try {
        const { data } = await updatePosition({ variables: { sessionId: sid, lat: pos.lat, lon: pos.lon, heading: pos.heading, speedMph: pos.speedMph } });
        if (!mountedRef.current) return;
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
  }, [updatePosition]);

  // ── AlertBanner action handler ──
  const handleAlertAction = (actionType) => {
    switch (actionType) {
      case 'REROUTE':
      case 'USE_ALTERNATE_ROUTE':
        setUserAcceptedReroute(true);
        addToast('Reroute accepted. Following alternate route.', { type: 'success', duration: 5000 });
        break;
      case 'EXIT_TO_SHELTER':
      case 'SEEK_SHELTER':
      case 'EXIT_HIGHWAY':
      case 'PREPARE_TO_EXIT':
        addToast('Navigating to nearest shelter. Follow green markers on map.', { type: 'warning', duration: 5000 });
        break;
      case 'PULL_OVER':
        addToast('Pull over advisory acknowledged. Find a safe location to stop.', { type: 'warning', duration: 5000 });
        break;
      case 'EMERGENCY_SHELTER_IN_VEHICLE':
        addToast('Shelter in vehicle! Stay buckled, engine running, head below windows.', { type: 'error', duration: 8000 });
        break;
      case 'TAKE_COVER':
        addToast('TAKE COVER NOW! Get to lowest interior room away from windows.', { type: 'error', duration: 8000 });
        break;
      case 'REDUCE_SPEED':
        addToast('Reduce speed. Hazardous conditions ahead.', { type: 'warning', duration: 5000 });
        break;
      case 'CONTINUE_MONITORING':
        addToast('Conditions are being monitored. Stay alert.', { type: 'info' });
        break;
      default:
        addToast('Action acknowledged.', { type: 'info' });
    }
  };

  // ── End trip ──
  const handleEndTrip = async () => {
    stopAlerts();
    if (geoWatchIdRef.current != null) navigator.geolocation.clearWatch(geoWatchIdRef.current);
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (realTimerRef.current) clearInterval(realTimerRef.current);

    if (sessionId) {
      try {
        const { data } = await endTrip({ variables: { sessionId } });
        navigate('/summary', { state: { summary: data?.endTrip } });
        return;
      } catch { /* fallthrough */ }
    }

    navigate('/summary', {
      state: {
        summary: {
          totalDistanceMiles: routeInfo?.distance || 0,
          totalTimeMinutes: Math.floor(realElapsedSeconds / 60),
          maxRiskScore: realTripData?.riskScore || 0,
          alertsReceived: 0,
          actionsRecommended: 0,
        },
      },
    });
  };

  // ── Derived display values ──
  const travelerPos = realTravelerPos;
  const heading = realHeading;
  const riskScore = realTripData?.riskScore || 0;
  const alertTier = realTripData?.tier || 'MONITORING';
  const alertMessage = realTripData?.alertMessage || '';
  const action = realTripData?.recommendedAction || 'CONTINUE';
  const displayStormCells = realTripData?.stormCells || [];
  const displayShelters = realTripData?.shelters || [];
  const altRoute = realTripData?.alternateRoute || null;

  const isDanger = alertTier === 'IMMEDIATE_DANGER';

  const elapsedDisplay = `${Math.floor(realElapsedSeconds / 60)}:${String(realElapsedSeconds % 60).padStart(2, '0')}`;

  const showMapSkeleton = routeWaypoints.length === 0;
  const showSidebarSkeleton = routeInfo === null;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-ww-dark" style={{ overflow: 'hidden' }}>
      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Full-screen map */}
      <div className="absolute inset-0 z-0">
        {showMapSkeleton ? (
          <MapSkeleton />
        ) : (
          <WeatherMap
            currentPosition={travelerPos}
            travelerHeading={heading}
            route={routeWaypoints}
            currentWaypointIndex={0}
            dangerZone={null}
            alternateRoute={altRoute}
            stormCells={displayStormCells}
            shelters={displayShelters}
            userAcceptedReroute={userAcceptedReroute}
            initialCenter={
              origin ? [origin.lat, origin.lon] : [37.5, -84.3]
            }
          />
        )}
      </div>

      {/* Danger overlay */}
      <DangerOverlay active={isDanger} message={alertMessage} />

      {/* LIVE badge — top-left */}
      <div className="absolute top-3 left-3 z-[600]">
        <div className="flex items-center gap-1.5 bg-green-700/90 backdrop-blur-sm text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-lg">
          <span className="inline-block w-2 h-2 rounded-full bg-white animate-pulse" />
          LIVE
        </div>
      </div>

      {/* Alert banner - top center, avoids sidebar */}
      <div className="absolute top-3 left-16 right-4 md:right-[310px] z-[500]">
        <AlertBanner
          tier={alertTier}
          message={alertMessage}
          action={action}
          countdown={null}
          shelters={displayShelters}
          alternateRoute={altRoute}
          onAction={handleAlertAction}
        />
      </div>

      {/* Right sidebar panel */}
      <div className="absolute bottom-0 left-0 right-0 md:top-3 md:bottom-auto md:left-auto md:right-3 z-[500] w-full md:w-72 space-y-3 max-h-[40vh] md:max-h-none overflow-y-auto md:overflow-visible p-2 md:p-0">
        {showSidebarSkeleton ? (
          <SidebarSkeleton />
        ) : (
          <>
            <RiskGauge score={riskScore} tier={alertTier} />
            <div className="bg-ww-surface/90 backdrop-blur-sm border border-ww-border rounded-xl p-4">
              <InfoPanel
                data={{ riskScore, tier: alertTier, alertMessage, recommendedAction: action, stormCells: displayStormCells, shelters: displayShelters, alternateRoute: altRoute }}
                elapsedMinutes={Math.floor(realElapsedSeconds / 60)}
              />
              {routeInfo && (
                <div className="mt-3 flex items-center justify-between text-sm border-t border-ww-border pt-3">
                  <span className="text-gray-400">Route</span>
                  <span className="text-white font-mono">{routeInfo.distance} mi / ~{routeInfo.duration} min</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-3">
        <div className="bg-ww-surface/90 backdrop-blur-sm border border-ww-border rounded-xl px-4 py-3 text-center">
          <div className="text-xs text-gray-400">Elapsed</div>
          <div className="text-xl font-mono text-white">{elapsedDisplay}</div>
        </div>
        <button
          onClick={handleEndTrip}
          className="bg-ww-red hover:bg-red-700 text-white font-bold px-6 py-3 rounded-xl transition-colors active:scale-95"
        >
          End Trip
        </button>
      </div>
    </div>
  );
}

function computeHeading(from, to) {
  const dLon = (to.lon - from.lon) * Math.PI / 180;
  const lat1 = from.lat * Math.PI / 180;
  const lat2 = to.lat * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}
