import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ApolloClient, InMemoryCache, ApolloProvider, useQuery, gql } from '@apollo/client';
import WeatherMap from './WeatherMap';
import AlertBanner from './AlertBanner';
import RiskGauge from './RiskGauge';
import ShelterPanel from './ShelterPanel';
import RoutePanel from './RoutePanel';
import { triggerAudioAlert, resetAudioAlert } from './AudioAlert';
import {
  traveler as mockTraveler,
  stormCells as mockStormCells,
  alertPolygons as mockAlertPolygons,
  safeLocations as mockSafeLocations,
  currentRoute as mockCurrentRoute,
  alternateRoute as mockAlternateRoute,
  scenarios,
  scenarioOrder,
} from '../mockData';

// Apollo Client setup
const apolloClient = new ApolloClient({
  uri: 'http://localhost:8080/graphql',
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'network-only',
      errorPolicy: 'all',
    },
  },
});

// GraphQL query for traveler safety
const TRAVELER_SAFETY_QUERY = gql`
  query TravelerSafety($latitude: Float!, $longitude: Float!, $heading: Float!, $speed: Float!) {
    travelerSafety(
      latitude: $latitude
      longitude: $longitude
      heading: $heading
      speed: $speed
    ) {
      riskScore
      tier
      alertMessage
      instruction
      actionType
      timeToImpact
      stormCells {
        id
        type
        severity
        centerLat
        centerLon
        polygon
      }
      safeLocations {
        id
        name
        latitude
        longitude
        distance
        hasIndoorShelter
      }
    }
  }
`;

function AppContent() {
  // Scenario state
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [useMockData, setUseMockData] = useState(true);
  const [showShelterPanel, setShowShelterPanel] = useState(false);
  const [showRoutePanel, setShowRoutePanel] = useState(false);
  const [rerouteAccepted, setRerouteAccepted] = useState(false);
  const audioInitialized = useRef(false);

  const currentScenarioKey = scenarioOrder[scenarioIndex];
  const currentScenario = scenarios[currentScenarioKey];

  // Try backend query (will gracefully fail to mock data)
  const { data: backendData, error: backendError } = useQuery(TRAVELER_SAFETY_QUERY, {
    variables: {
      latitude: mockTraveler.latitude,
      longitude: mockTraveler.longitude,
      heading: mockTraveler.heading,
      speed: mockTraveler.speed,
    },
    pollInterval: 5000,
    skip: useMockData,
  });

  // Auto-switch to mock data if backend unavailable
  useEffect(() => {
    if (backendError) {
      setUseMockData(true);
    }
  }, [backendError]);

  // Derive display data from scenario or backend
  const displayData = useMemo(() => {
    if (!useMockData && backendData?.travelerSafety) {
      return backendData.travelerSafety;
    }
    return currentScenario;
  }, [useMockData, backendData, currentScenario]);

  // Audio alerts when tier changes
  useEffect(() => {
    if (displayData.tier && displayData.tier !== 'NONE') {
      triggerAudioAlert(displayData.tier, displayData.alertMessage);
    }
    return () => {
      // Cleanup handled by resetAudioAlert on scenario change
    };
  }, [displayData.tier, displayData.alertMessage]);

  // Reset panels when scenario changes
  useEffect(() => {
    setShowShelterPanel(currentScenario.showShelterPanel);
    setShowRoutePanel(currentScenario.showRoutePanel);
    setRerouteAccepted(false);
    resetAudioAlert();
  }, [currentScenarioKey]);

  // Cycle through scenarios
  const handleCycleScenario = useCallback(() => {
    // Initialize audio context on first user interaction
    if (!audioInitialized.current) {
      audioInitialized.current = true;
    }
    setScenarioIndex((prev) => (prev + 1) % scenarioOrder.length);
  }, []);

  // Action button handler
  const handleActionClick = useCallback(() => {
    if (currentScenario.actionType === 'REROUTE') {
      setShowRoutePanel(true);
    } else if (currentScenario.actionType === 'EXIT_TO_SHELTER') {
      setShowShelterPanel(true);
    }
  }, [currentScenario.actionType]);

  // Accept reroute
  const handleAcceptReroute = useCallback(() => {
    setRerouteAccepted(true);
    setShowRoutePanel(false);
  }, []);

  // Navigate to shelter
  const handleNavigateToShelter = useCallback((shelter) => {
    setShowShelterPanel(false);
    // In a real app, this would trigger navigation
  }, []);

  // Determine map properties based on scenario
  const showStormCells = currentScenario.stormCellsVisible;
  const showAlertPolygons = currentScenario.alertPolygonsVisible;
  const routeSafe = currentScenario.routeSafe;
  const showAlternateRoute = currentScenario.actionType === 'REROUTE' || rerouteAccepted;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-ww-dark">
      {/* Full-screen map */}
      <div className="absolute inset-0 z-0">
        <WeatherMap
          traveler={mockTraveler}
          stormCells={showStormCells ? mockStormCells : []}
          alertPolygons={showAlertPolygons ? mockAlertPolygons : []}
          safeLocations={mockSafeLocations}
          currentRoute={mockCurrentRoute}
          alternateRoute={mockAlternateRoute}
          routeSafe={routeSafe}
          showStormCells={showStormCells}
          showAlertPolygons={showAlertPolygons}
          showAlternateRoute={showAlternateRoute}
        />
      </div>

      {/* Alert Banner (overlaid on top) */}
      <AlertBanner
        tier={displayData.tier}
        alertMessage={displayData.alertMessage}
        instruction={displayData.instruction}
        actionType={displayData.actionType}
        timeToImpact={displayData.timeToImpact}
        onActionClick={handleActionClick}
        onDismiss={() => {}}
      />

      {/* Risk Gauge (top-right corner, pushed down if ACTION_REQUIRED banner) */}
      <div
        className="absolute z-[999] transition-all duration-300"
        style={{
          top: displayData.tier === 'ACTION_REQUIRED' ? 130 : displayData.tier === 'ADVISORY' ? 54 : 12,
          right: 12,
        }}
      >
        <RiskGauge score={displayData.riskScore} />
      </div>

      {/* Shelter Panel */}
      <ShelterPanel
        shelters={mockSafeLocations}
        visible={showShelterPanel}
        onNavigate={handleNavigateToShelter}
        onClose={() => setShowShelterPanel(false)}
      />

      {/* Route Panel */}
      <RoutePanel
        visible={showRoutePanel}
        currentRoute={mockCurrentRoute}
        alternateRoute={mockAlternateRoute}
        onAcceptReroute={handleAcceptReroute}
        onClose={() => setShowRoutePanel(false)}
      />

      {/* Scenario toggle button (bottom-right corner) */}
      {displayData.tier !== 'IMMEDIATE_DANGER' && (
        <div className="absolute bottom-4 right-4 z-[1000]">
          <button
            onClick={handleCycleScenario}
            className="flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all active:scale-95"
            style={{
              backgroundColor: 'rgba(22, 27, 34, 0.92)',
              color: '#e6edf3',
              border: '1px solid #30363d',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              minHeight: '48px',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"
                stroke="#E65100"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span>
              <span className="text-gray-400 mr-1">Scenario:</span>
              {currentScenario.label}
            </span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 5l3 3 3-3" stroke="#8b949e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}

      {/* Mock data indicator */}
      {useMockData && displayData.tier !== 'IMMEDIATE_DANGER' && (
        <div
          className="absolute bottom-4 left-4 z-[1000] px-3 py-2 rounded-lg text-xs"
          style={{
            backgroundColor: 'rgba(22, 27, 34, 0.85)',
            border: '1px solid #30363d',
            color: '#8b949e',
          }}
        >
          <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: '#F9A825' }} />
          Demo Mode (Mock Data)
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ApolloProvider client={apolloClient}>
      <AppContent />
    </ApolloProvider>
  );
}
