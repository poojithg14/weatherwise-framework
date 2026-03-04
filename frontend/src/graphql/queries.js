import { gql } from '@apollo/client';

export const START_TRIP = gql`
  mutation StartTrip($fromLat: Float!, $fromLon: Float!, $toLat: Float!, $toLon: Float!) {
    startTrip(fromLat: $fromLat, fromLon: $fromLon, toLat: $toLat, toLon: $toLon) {
      sessionId
      route { lat lon }
      estimatedDistanceMiles
      estimatedTimeMinutes
    }
  }
`;

export const UPDATE_POSITION = gql`
  mutation UpdatePosition($sessionId: ID!, $lat: Float!, $lon: Float!, $heading: Float!, $speedMph: Float!) {
    updatePosition(sessionId: $sessionId, lat: $lat, lon: $lon, heading: $heading, speedMph: $speedMph) {
      overallScore
      tier
      alertMessage
      recommendedAction
      hazardSpecificGuidance
      timeToIntersectionMinutes
      hazardType
      hazards { type severity distanceMiles direction etaMinutes }
      nearestShelters { name type distanceMiles hasIndoorShelter exitNumber }
      alternateRoute { waypoints { lat lon } distanceMiles timeMinutes safetyScore }
      countdown { minutesUntilIntersection message }
    }
  }
`;

export const END_TRIP = gql`
  mutation EndTrip($sessionId: ID!) {
    endTrip(sessionId: $sessionId) {
      totalDistanceMiles
      totalTimeMinutes
      maxRiskScore
      alertsReceived
      actionsRecommended
    }
  }
`;

export const GET_STORM_CELLS = gql`
  query StormCells($lat: Float!, $lon: Float!, $radiusMiles: Float!) {
    stormCells(lat: $lat, lon: $lon, radiusMiles: $radiusMiles) {
      id lat lon velocityX velocityY vil rotation hazardType
      predictedPath { time vertices { lat lon } }
    }
  }
`;

export const GET_ACTIVE_ALERTS = gql`
  query ActiveAlerts($lat: Float!, $lon: Float!, $radiusMiles: Float!) {
    activeAlerts(lat: $lat, lon: $lon, radiusMiles: $radiusMiles) {
      id type severity polygon { lat lon } effectiveTime expirationTime
    }
  }
`;

export const GET_SAFE_LOCATIONS = gql`
  query SafeLocations($lat: Float!, $lon: Float!, $radiusMiles: Float!) {
    safeLocations(lat: $lat, lon: $lon, radiusMiles: $radiusMiles) {
      name locationType lat lon distanceMiles hasIndoorShelter exitNumber
    }
  }
`;

export const GET_TRAVELER_SAFETY = gql`
  query TravelerSafety($lat: Float!, $lon: Float!, $heading: Float!, $speedMph: Float!) {
    travelerSafety(lat: $lat, lon: $lon, heading: $heading, speedMph: $speedMph) {
      overallScore
      tier
      alertMessage
      recommendedAction
      hazardSpecificGuidance
      timeToIntersectionMinutes
      hazardType
    }
  }
`;
