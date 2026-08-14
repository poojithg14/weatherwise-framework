import { useState, useEffect, useRef } from 'react';

export function useTripSimulation(routeWaypoints, scenarioTimeline, isDemo) {
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [currentPosition, setCurrentPosition] = useState(null);
  const [currentHeading, setCurrentHeading] = useState(0);
  const [riskScore, setRiskScore] = useState(0.05);
  const [alertTier, setAlertTier] = useState('MONITORING');
  const [alertMessage, setAlertMessage] = useState('All clear. Monitoring conditions along your route.');
  const [stormCells, setStormCells] = useState([]);
  const [shelters, setShelters] = useState([]);
  const [alternateRoute, setAlternateRoute] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [dangerZone, setDangerZone] = useState(null);
  const [recommendedAction, setRecommendedAction] = useState('CONTINUE');
  const [currentWaypointIndex, setCurrentWaypointIndex] = useState(0);
  const [isSimulationRunning, setIsSimulationRunning] = useState(false);
  const intervalRef = useRef(null);
  const cumulativeDistances = useRef([]);
  const prevPosRef = useRef(null);

  // Haversine distance in miles
  function haversine(lat1, lon1, lat2, lon2) {
    const R = 3959;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // Compute heading between two points in degrees
  function computeHeading(from, to) {
    if (!from || !to) return 0;
    const dLon = (to.lon - from.lon) * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(to.lat * Math.PI / 180);
    const x = Math.cos(from.lat * Math.PI / 180) * Math.sin(to.lat * Math.PI / 180)
      - Math.sin(from.lat * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180) * Math.cos(dLon);
    return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
  }

  // Precompute cumulative distances along route
  useEffect(() => {
    if (!routeWaypoints || routeWaypoints.length < 2) return;
    const dists = [0];
    for (let i = 1; i < routeWaypoints.length; i++) {
      dists.push(dists[i - 1] + haversine(
        routeWaypoints[i - 1].lat, routeWaypoints[i - 1].lon,
        routeWaypoints[i].lat, routeWaypoints[i].lon
      ));
    }
    cumulativeDistances.current = dists;
    setCurrentPosition({ ...routeWaypoints[0] });
    prevPosRef.current = routeWaypoints[0];
  }, [routeWaypoints]);

  // Interpolate position at target distance along route
  function positionAtDistance(targetMiles) {
    const dists = cumulativeDistances.current;
    const wps = routeWaypoints;
    if (!dists.length || !wps.length) return wps?.[0] || null;
    if (targetMiles <= 0) return { ...wps[0] };
    if (targetMiles >= dists[dists.length - 1]) return { ...wps[wps.length - 1] };
    for (let i = 1; i < dists.length; i++) {
      if (dists[i] >= targetMiles) {
        const frac = (targetMiles - dists[i - 1]) / (dists[i] - dists[i - 1]);
        return {
          lat: wps[i - 1].lat + frac * (wps[i].lat - wps[i - 1].lat),
          lon: wps[i - 1].lon + frac * (wps[i].lon - wps[i - 1].lon)
        };
      }
    }
    return { ...wps[wps.length - 1] };
  }

  // Find the waypoint index closest to a distance
  function waypointIndexAtDistance(targetMiles) {
    const dists = cumulativeDistances.current;
    for (let i = 1; i < dists.length; i++) {
      if (dists[i] >= targetMiles) return i;
    }
    return dists.length - 1;
  }

  // Start simulation when demo mode is active
  useEffect(() => {
    if (!isDemo || !routeWaypoints || routeWaypoints.length < 2) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setIsSimulationRunning(false);
      return;
    }

    // Reset state
    setElapsedMinutes(0);
    setRiskScore(0.05);
    setAlertTier('MONITORING');
    setAlertMessage('All clear. Monitoring conditions along your route.');
    setStormCells([]);
    setShelters([]);
    setAlternateRoute(null);
    setCountdown(null);
    setDangerZone(null);
    setRecommendedAction('CONTINUE');
    setCurrentWaypointIndex(0);
    setCurrentPosition({ ...routeWaypoints[0] });
    prevPosRef.current = routeWaypoints[0];
    setIsSimulationRunning(true);

    let minutes = 0;

    intervalRef.current = setInterval(() => {
      minutes += 1;
      setElapsedMinutes(minutes);

      // 70 mph = 1.1667 miles per minute
      const distanceTraveled = minutes * 1.1667;
      const totalDistance = cumulativeDistances.current[cumulativeDistances.current.length - 1] || 999;

      // Stop simulation if we reached the end
      if (distanceTraveled >= totalDistance) {
        clearInterval(intervalRef.current);
        setIsSimulationRunning(false);
        return;
      }

      // Update position
      const newPos = positionAtDistance(distanceTraveled);
      if (newPos) {
        const prev = prevPosRef.current;
        if (prev) {
          setCurrentHeading(computeHeading(prev, newPos));
        }
        prevPosRef.current = newPos;
        setCurrentPosition({ ...newPos }); // spread forces re-render
        setCurrentWaypointIndex(waypointIndexAtDistance(distanceTraveled));
      }

      // Check scenario timeline
      if (scenarioTimeline?.length) {
        let activeEvent = null;
        for (let i = scenarioTimeline.length - 1; i >= 0; i--) {
          if (scenarioTimeline[i].minutesMark <= minutes) {
            activeEvent = scenarioTimeline[i];
            break;
          }
        }
        if (activeEvent) {
          const raw = activeEvent.riskScore ?? 5;
          setRiskScore(raw > 1 ? raw / 100 : raw);
          setAlertTier(activeEvent.tier ?? 'MONITORING');
          setAlertMessage(activeEvent.alertMessage ?? 'Monitoring.');
          if (activeEvent.stormCells) setStormCells(activeEvent.stormCells);
          if (activeEvent.shelters) setShelters(activeEvent.shelters);
          if (activeEvent.alternateRoute) setAlternateRoute(activeEvent.alternateRoute);
          else setAlternateRoute(null);
          if (activeEvent.dangerZone) setDangerZone(activeEvent.dangerZone);
          else setDangerZone(null);
          setRecommendedAction(activeEvent.recommendedAction ?? 'CONTINUE');
          if (activeEvent.countdownMinutes != null) {
            const remaining = activeEvent.countdownMinutes - (minutes - activeEvent.minutesMark);
            setCountdown(remaining > 0 ? remaining : null);
          } else {
            setCountdown(null);
          }
        }
      }
    }, 1000); // 1 second = 1 minute of travel

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isDemo, routeWaypoints, scenarioTimeline]);

  return {
    currentPosition,
    currentHeading,
    currentSpeed: isDemo && isSimulationRunning ? 70 : 0,
    riskScore,
    alertTier,
    alertMessage,
    stormCells,
    shelters,
    alternateRoute,
    elapsedMinutes,
    countdown,
    dangerZone,
    recommendedAction,
    currentWaypointIndex,
    isSimulationRunning
  };
}
