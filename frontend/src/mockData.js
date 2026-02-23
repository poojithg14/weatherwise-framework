// Mock data for WeatherWise - Louisville I-64 Tornado Scenario
// Traveler heading west on I-64 from Louisville toward St. Louis

export const traveler = {
  id: 'traveler-001',
  latitude: 38.25,
  longitude: -85.76,
  heading: 270, // west
  speed: 65, // mph
  vehicleType: 'SEDAN',
};

// Storm cells
export const stormCells = [
  {
    id: 'cell-tornado-001',
    type: 'TORNADO',
    severity: 'EXTREME',
    centerLat: 38.17,
    centerLon: -85.25,
    movementBearing: 45, // NE
    movementSpeed: 35, // mph
    polygon: [
      [38.12, -85.32],
      [38.14, -85.18],
      [38.22, -85.18],
      [38.22, -85.32],
      [38.12, -85.32],
    ],
    predictedPath: [
      {
        time: 15,
        polygon: [
          [38.16, -85.28],
          [38.18, -85.14],
          [38.26, -85.14],
          [38.26, -85.28],
          [38.16, -85.28],
        ],
        opacity: 0.6,
      },
      {
        time: 30,
        polygon: [
          [38.20, -85.22],
          [38.22, -85.08],
          [38.30, -85.08],
          [38.30, -85.22],
          [38.20, -85.22],
        ],
        opacity: 0.35,
      },
      {
        time: 45,
        polygon: [
          [38.24, -85.16],
          [38.26, -85.02],
          [38.34, -85.02],
          [38.34, -85.16],
          [38.24, -85.16],
        ],
        opacity: 0.15,
      },
    ],
    hailSize: 2.5, // inches
    maxWindSpeed: 140, // mph
    rotationRate: 0.025,
    color: '#D32F2F',
    label: 'Tornado-Warned Supercell',
  },
  {
    id: 'cell-tstorm-002',
    type: 'SEVERE_THUNDERSTORM',
    severity: 'SEVERE',
    centerLat: 38.10,
    centerLon: -85.40,
    movementBearing: 40,
    movementSpeed: 30,
    polygon: [
      [38.03, -85.50],
      [38.03, -85.30],
      [38.17, -85.30],
      [38.17, -85.50],
      [38.03, -85.50],
    ],
    predictedPath: [
      {
        time: 20,
        polygon: [
          [38.08, -85.45],
          [38.08, -85.25],
          [38.22, -85.25],
          [38.22, -85.45],
          [38.08, -85.45],
        ],
        opacity: 0.5,
      },
      {
        time: 40,
        polygon: [
          [38.13, -85.38],
          [38.13, -85.18],
          [38.27, -85.18],
          [38.27, -85.38],
          [38.13, -85.38],
        ],
        opacity: 0.25,
      },
    ],
    hailSize: 1.75,
    maxWindSpeed: 80,
    rotationRate: 0,
    color: '#E65100',
    label: 'Severe Thunderstorm Cell',
  },
];

// NWS Alert Polygons
export const alertPolygons = [
  {
    id: 'alert-tornado-warning',
    type: 'TORNADO_WARNING',
    label: 'Tornado Warning',
    color: '#FF0000',
    fillColor: 'rgba(255, 0, 0, 0.12)',
    borderColor: '#FF0000',
    polygon: [
      [38.05, -85.40],
      [38.05, -85.10],
      [38.30, -85.10],
      [38.30, -85.40],
      [38.05, -85.40],
    ],
    expires: '2026-02-23T22:30:00Z',
    headline: 'TORNADO WARNING: Take shelter immediately. A confirmed tornado is moving northeast at 35 mph.',
    source: 'NWS Louisville',
  },
  {
    id: 'alert-svr-tstorm',
    type: 'SEVERE_THUNDERSTORM_WARNING',
    label: 'Severe Thunderstorm Warning',
    color: '#FF8C00',
    fillColor: 'rgba(255, 140, 0, 0.1)',
    borderColor: '#FF8C00',
    polygon: [
      [37.95, -85.55],
      [37.95, -85.25],
      [38.20, -85.25],
      [38.20, -85.55],
      [37.95, -85.55],
    ],
    expires: '2026-02-23T23:00:00Z',
    headline: 'SEVERE THUNDERSTORM WARNING: 70 mph winds and quarter-size hail expected.',
    source: 'NWS Louisville',
  },
  {
    id: 'alert-flash-flood',
    type: 'FLASH_FLOOD_WATCH',
    label: 'Flash Flood Watch',
    color: '#00AA00',
    fillColor: 'rgba(0, 170, 0, 0.06)',
    borderColor: '#00AA00',
    polygon: [
      [37.90, -85.90],
      [37.90, -85.10],
      [38.40, -85.10],
      [38.40, -85.90],
      [37.90, -85.90],
    ],
    expires: '2026-02-24T06:00:00Z',
    headline: 'FLASH FLOOD WATCH: Heavy rainfall of 2-4 inches expected through overnight hours.',
    source: 'NWS Louisville',
  },
];

// Safe locations along I-64 exits
export const safeLocations = [
  {
    id: 'shelter-pilot-28',
    name: 'Pilot Travel Center',
    exitInfo: 'Exit 28, I-64',
    latitude: 38.2130,
    longitude: -85.1850,
    type: 'GAS_STATION',
    hasIndoorShelter: true,
    distance: 3.2, // miles from traveler
    driveTime: 4, // minutes
    address: '100 Travel Center Dr, Shelbyville, KY 40065',
    phone: '(502) 633-4400',
    isOpen: true,
  },
  {
    id: 'shelter-rest-area',
    name: 'Shelby County Rest Area',
    exitInfo: 'Mile Marker 30, I-64',
    latitude: 38.2280,
    longitude: -85.2200,
    type: 'REST_AREA',
    hasIndoorShelter: true,
    distance: 5.1,
    driveTime: 6,
    address: 'I-64 Westbound, Shelby County, KY',
    phone: null,
    isOpen: true,
  },
  {
    id: 'shelter-loves-35',
    name: "Love's Travel Stop",
    exitInfo: 'Exit 35, I-64',
    latitude: 38.2350,
    longitude: -85.2800,
    type: 'GAS_STATION',
    hasIndoorShelter: true,
    distance: 7.8,
    driveTime: 9,
    address: '2501 Midland Trail, Shelbyville, KY 40065',
    phone: '(502) 633-1200',
    isOpen: true,
  },
  {
    id: 'shelter-thorntons-32',
    name: "Thornton's Gas Station",
    exitInfo: 'Exit 32, I-64',
    latitude: 38.2200,
    longitude: -85.2500,
    type: 'GAS_STATION',
    hasIndoorShelter: false,
    distance: 6.0,
    driveTime: 7,
    address: '1890 Midland Trail, Shelbyville, KY 40065',
    phone: '(502) 633-8800',
    isOpen: true,
  },
  {
    id: 'shelter-comfort-inn',
    name: 'Comfort Inn Shelbyville',
    exitInfo: 'Exit 32, I-64',
    latitude: 38.2180,
    longitude: -85.2450,
    type: 'HOTEL',
    hasIndoorShelter: true,
    distance: 5.8,
    driveTime: 7,
    address: '120 Howard Dr, Shelbyville, KY 40065',
    phone: '(502) 633-4005',
    isOpen: true,
  },
];

// Routes
export const currentRoute = {
  id: 'route-i64-main',
  name: 'I-64 W to St. Louis',
  distance: 264, // miles
  estimatedTime: 240, // minutes
  waypoints: [
    [38.2540, -85.7600],
    [38.2520, -85.7200],
    [38.2500, -85.6800],
    [38.2480, -85.6400],
    [38.2460, -85.6000],
    [38.2440, -85.5600],
    [38.2420, -85.5200],
    [38.2400, -85.4800],
    [38.2380, -85.4400],
    [38.2360, -85.4000],
    [38.2340, -85.3600],
    [38.2320, -85.3200],
    [38.2300, -85.2800],
    [38.2280, -85.2400],
    [38.2260, -85.2000],
    [38.2240, -85.1600],
    [38.2220, -85.1200],
    [38.2200, -85.0800],
    [38.2180, -85.0400],
    [38.2160, -85.0000],
  ],
};

export const alternateRoute = {
  id: 'route-us60-south',
  name: 'US-60 S via Versailles',
  distance: 289, // miles
  estimatedTime: 275, // minutes
  addedTime: 35, // minutes longer than current
  safetyScore: 92,
  waypoints: [
    [38.2540, -85.7600],
    [38.2400, -85.7400],
    [38.2200, -85.7200],
    [38.1900, -85.7000],
    [38.1600, -85.6800],
    [38.1300, -85.7000],
    [38.1000, -85.7300],
    [38.0700, -85.7600],
    [38.0500, -85.8000],
    [38.0300, -85.8500],
    [38.0200, -85.9000],
    [38.0100, -85.9500],
    [38.0050, -86.0000],
    [38.0000, -86.0500],
    [37.9950, -86.1000],
    [37.9900, -86.1500],
    [37.9850, -86.2000],
    [37.9800, -86.2500],
    [38.0000, -86.3000],
    [38.0500, -86.4000],
  ],
};

// Scenario presets
export const scenarios = {
  safe: {
    id: 'safe',
    label: 'All Clear',
    tier: 'ADVISORY',
    riskScore: 18,
    alertMessage: 'Weather advisory in effect for your area. Storms possible in 2 hours.',
    actionType: null,
    instruction: 'Continue on current route. Monitor conditions.',
    timeToImpact: 120, // minutes
    showShelterPanel: false,
    showRoutePanel: false,
    routeSafe: true,
    stormCellsVisible: false,
    alertPolygonsVisible: true,
  },
  stormApproaching: {
    id: 'stormApproaching',
    label: 'Storm Approaching',
    tier: 'ACTION_REQUIRED',
    riskScore: 62,
    alertMessage: 'Severe thunderstorm approaching your route. Tornado-warned cell 25 miles east moving NE at 35 mph. Reroute recommended.',
    actionType: 'REROUTE',
    instruction: 'Take US-60 South via Versailles to avoid storm path. Adds 35 minutes.',
    timeToImpact: 22, // minutes
    showShelterPanel: false,
    showRoutePanel: true,
    routeSafe: false,
    stormCellsVisible: true,
    alertPolygonsVisible: true,
  },
  noSafeRoute: {
    id: 'noSafeRoute',
    label: 'No Safe Route',
    tier: 'ACTION_REQUIRED',
    riskScore: 78,
    alertMessage: 'All routes blocked by severe weather. Exit highway and seek shelter immediately.',
    actionType: 'EXIT_TO_SHELTER',
    instruction: 'Take Exit 32 to Comfort Inn Shelbyville. Indoor shelter available. 5.8 miles ahead.',
    timeToImpact: 12, // minutes
    showShelterPanel: true,
    showRoutePanel: false,
    routeSafe: false,
    stormCellsVisible: true,
    alertPolygonsVisible: true,
  },
  tornadoImminent: {
    id: 'tornadoImminent',
    label: 'Tornado Imminent',
    tier: 'IMMEDIATE_DANGER',
    riskScore: 95,
    alertMessage: 'TORNADO ON THE GROUND 3 MILES FROM YOUR LOCATION. PULL OVER AND TAKE COVER NOW.',
    actionType: 'PULL_OVER',
    instruction: 'PULL OVER IMMEDIATELY. Get below road level in a ditch. Cover your head. Do NOT stay in your vehicle under an overpass.',
    timeToImpact: 3, // minutes
    showShelterPanel: false,
    showRoutePanel: false,
    routeSafe: false,
    stormCellsVisible: true,
    alertPolygonsVisible: true,
  },
};

export const scenarioOrder = ['safe', 'stormApproaching', 'noSafeRoute', 'tornadoImminent'];
