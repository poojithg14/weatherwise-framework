// London KY EF-4 Tornado — May 16, 2025
// Knoxville TN → Lexington KY via I-75 (~175 miles)
// 100 waypoints interpolated between 10 real I-75 cities

export default {
  id: 'london-ky-tornado',
  name: 'London KY EF-4 Tornado',
  description: 'EF-4 tornado crosses I-75 near London, KY while traveler drives from Knoxville to Lexington. Based on May 16, 2025 event.',
  hazardType: 'TORNADO',
  region: 'I-75 Corridor, Knoxville to Lexington',
  center: { lat: 37.09, lon: -84.08 },
  source: { lat: 35.9606, lon: -83.9207, name: 'Knoxville, TN' },
  destination: { lat: 38.0406, lon: -84.5037, name: 'Lexington, KY' },
  route: {
    from: { lat: 35.9606, lon: -83.9207, label: 'Knoxville, TN' },
    to: { lat: 38.0406, lon: -84.5037, label: 'Lexington, KY' },
  },

  // 100 waypoints along I-75 from Knoxville TN to Lexington KY
  // Interpolated: 10 intermediate points between each pair of 10 real cities
  routeWaypoints: [
    // ── Segment 0: Knoxville → Caryville ──
    { lat: 35.9606, lon: -83.9207 }, // Knoxville TN
    { lat: 35.9913, lon: -83.9484 },
    { lat: 36.0219, lon: -83.9760 },
    { lat: 36.0526, lon: -84.0037 },
    { lat: 36.0833, lon: -84.0314 },
    { lat: 36.1139, lon: -84.0590 },
    { lat: 36.1446, lon: -84.0867 },
    { lat: 36.1753, lon: -84.1144 },
    { lat: 36.2059, lon: -84.1420 },
    { lat: 36.2366, lon: -84.1697 },
    { lat: 36.2673, lon: -84.1974 },

    // ── Segment 1: Caryville → Jellico ──
    { lat: 36.2979, lon: -84.2250 }, // Caryville TN
    { lat: 36.3243, lon: -84.2161 },
    { lat: 36.3507, lon: -84.2072 },
    { lat: 36.3770, lon: -84.1983 },
    { lat: 36.4034, lon: -84.1894 },
    { lat: 36.4298, lon: -84.1805 },
    { lat: 36.4562, lon: -84.1716 },
    { lat: 36.4825, lon: -84.1627 },
    { lat: 36.5089, lon: -84.1538 },
    { lat: 36.5353, lon: -84.1449 },
    { lat: 36.5616, lon: -84.1360 },

    // ── Segment 2: Jellico → Williamsburg ──
    { lat: 36.5880, lon: -84.1271 }, // Jellico TN
    { lat: 36.6021, lon: -84.1301 },
    { lat: 36.6162, lon: -84.1330 },
    { lat: 36.6303, lon: -84.1360 },
    { lat: 36.6445, lon: -84.1390 },
    { lat: 36.6586, lon: -84.1419 },
    { lat: 36.6727, lon: -84.1449 },
    { lat: 36.6868, lon: -84.1478 },
    { lat: 36.7010, lon: -84.1508 },
    { lat: 36.7151, lon: -84.1538 },
    { lat: 36.7292, lon: -84.1567 },

    // ── Segment 3: Williamsburg → Corbin ──
    { lat: 36.7433, lon: -84.1597 }, // Williamsburg KY
    { lat: 36.7620, lon: -84.1540 },
    { lat: 36.7806, lon: -84.1483 },
    { lat: 36.7993, lon: -84.1426 },
    { lat: 36.8180, lon: -84.1369 },
    { lat: 36.8366, lon: -84.1311 },
    { lat: 36.8553, lon: -84.1254 },
    { lat: 36.8740, lon: -84.1197 },
    { lat: 36.8926, lon: -84.1140 },
    { lat: 36.9113, lon: -84.1083 },
    { lat: 36.9300, lon: -84.1026 },

    // ── Segment 4: Corbin → London ──
    { lat: 36.9486, lon: -84.0968 }, // Corbin KY
    { lat: 36.9613, lon: -84.0956 },
    { lat: 36.9739, lon: -84.0943 },
    { lat: 36.9866, lon: -84.0931 },
    { lat: 36.9993, lon: -84.0919 },
    { lat: 37.0119, lon: -84.0907 },
    { lat: 37.0246, lon: -84.0894 },
    { lat: 37.0373, lon: -84.0882 },
    { lat: 37.0499, lon: -84.0870 },
    { lat: 37.0626, lon: -84.0857 },
    { lat: 37.0753, lon: -84.0845 },

    // ── Segment 5: London → Mount Vernon ──
    { lat: 37.0879, lon: -84.0833 }, // London KY
    { lat: 37.1121, lon: -84.1070 },
    { lat: 37.1362, lon: -84.1307 },
    { lat: 37.1603, lon: -84.1545 },
    { lat: 37.1845, lon: -84.1782 },
    { lat: 37.2086, lon: -84.2019 },
    { lat: 37.2327, lon: -84.2257 },
    { lat: 37.2569, lon: -84.2494 },
    { lat: 37.2810, lon: -84.2731 },
    { lat: 37.3051, lon: -84.2968 },
    { lat: 37.3293, lon: -84.3206 },

    // ── Segment 6: Mount Vernon → Berea ──
    { lat: 37.3534, lon: -84.3443 }, // Mount Vernon KY
    { lat: 37.3730, lon: -84.3399 },
    { lat: 37.3926, lon: -84.3356 },
    { lat: 37.4121, lon: -84.3312 },
    { lat: 37.4317, lon: -84.3268 },
    { lat: 37.4513, lon: -84.3225 },
    { lat: 37.4709, lon: -84.3181 },
    { lat: 37.4904, lon: -84.3137 },
    { lat: 37.5100, lon: -84.3094 },
    { lat: 37.5296, lon: -84.3050 },
    { lat: 37.5491, lon: -84.3006 },

    // ── Segment 7: Berea → Richmond ──
    { lat: 37.5687, lon: -84.2963 }, // Berea KY
    { lat: 37.5850, lon: -84.2961 },
    { lat: 37.6013, lon: -84.2960 },
    { lat: 37.6176, lon: -84.2958 },
    { lat: 37.6338, lon: -84.2957 },
    { lat: 37.6501, lon: -84.2955 },
    { lat: 37.6664, lon: -84.2954 },
    { lat: 37.6827, lon: -84.2952 },
    { lat: 37.6990, lon: -84.2951 },
    { lat: 37.7153, lon: -84.2949 },
    { lat: 37.7316, lon: -84.2948 },

    // ── Segment 8: Richmond → Lexington ──
    { lat: 37.7479, lon: -84.2947 }, // Richmond KY
    { lat: 37.7745, lon: -84.3137 },
    { lat: 37.8011, lon: -84.3327 },
    { lat: 37.8278, lon: -84.3517 },
    { lat: 37.8544, lon: -84.3707 },
    { lat: 37.8810, lon: -84.3897 },
    { lat: 37.9076, lon: -84.4087 },
    { lat: 37.9342, lon: -84.4277 },
    { lat: 37.9609, lon: -84.4467 },
    { lat: 37.9875, lon: -84.4657 },
    { lat: 38.0141, lon: -84.4847 },

    // Destination
    { lat: 38.0406, lon: -84.5037 }, // Lexington KY
  ],

  timeline: [
    {
      minutesMark: 0,
      riskScore: 5,
      tier: 'MONITORING',
      alertMessage: 'All clear. Monitoring conditions along your route.',
      recommendedAction: 'CONTINUE',
      stormCells: [],
      shelters: [],
      alternateRoute: null,
      dangerZone: null,
      countdownMinutes: null,
    },
    {
      minutesMark: 5,
      riskScore: 12,
      tier: 'MONITORING',
      alertMessage: 'Storm cell detected 60 miles west. Monitoring.',
      recommendedAction: 'CONTINUE',
      stormCells: [
        {
          lat: 37.02, lon: -85.03, radiusMiles: 8, severity: 'MODERATE', type: 'Supercell',
          pathWidthMiles: 1.0,
          warnPolygon: [
            { lat: 36.90, lon: -85.10 }, { lat: 37.20, lon: -85.10 },
            { lat: 37.20, lon: -83.85 }, { lat: 36.90, lon: -83.85 },
          ],
          impactPath: [
            { lat: 37.02, lon: -85.03 }, { lat: 37.04, lon: -84.65 },
            { lat: 37.06, lon: -84.40 }, { lat: 37.08, lon: -84.10 },
            { lat: 37.085, lon: -83.97 },
          ],
          predictedPath: [
            { lat: 37.03, lon: -84.90 },
            { lat: 37.04, lon: -84.77 },
            { lat: 37.05, lon: -84.64 },
            { lat: 37.06, lon: -84.51 },
          ],
        },
      ],
      shelters: [],
      alternateRoute: null,
      dangerZone: null,
      countdownMinutes: null,
    },
    {
      minutesMark: 10,
      riskScore: 22,
      tier: 'ADVISORY',
      alertMessage: 'Severe thunderstorm developing 45mi W of your route. Moving east at 40mph. Monitoring your route.',
      recommendedAction: 'CONTINUE',
      stormCells: [
        {
          lat: 37.03, lon: -84.80, radiusMiles: 10, severity: 'SEVERE', type: 'Supercell - Tornado Warned',
          pathWidthMiles: 1.0,
          warnPolygon: [
            { lat: 36.90, lon: -85.10 }, { lat: 37.20, lon: -85.10 },
            { lat: 37.20, lon: -83.85 }, { lat: 36.90, lon: -83.85 },
          ],
          impactPath: [
            { lat: 37.02, lon: -85.03 }, { lat: 37.03, lon: -84.80 },
            { lat: 37.04, lon: -84.65 }, { lat: 37.06, lon: -84.40 },
            { lat: 37.08, lon: -84.10 }, { lat: 37.085, lon: -83.97 },
          ],
          predictedPath: [
            { lat: 37.04, lon: -84.65 },
            { lat: 37.05, lon: -84.50 },
            { lat: 37.06, lon: -84.35 },
            { lat: 37.07, lon: -84.20 },
          ],
        },
      ],
      shelters: [],
      alternateRoute: null,
      dangerZone: null,
      countdownMinutes: null,
    },
    {
      minutesMark: 14,
      riskScore: 38,
      tier: 'ACTION_REQUIRED',
      alertMessage: 'TORNADO WARNING. Supercell approaching I-75 near London. Storm will cross your route in ~22 minutes. Safe alternate route via US-25 adds 18 minutes.',
      recommendedAction: 'REROUTE',
      stormCells: [
        {
          lat: 37.05, lon: -84.55, radiusMiles: 12, severity: 'EXTREME', type: 'Tornado-Producing Supercell',
          pathWidthMiles: 1.0,
          warnPolygon: [
            { lat: 36.90, lon: -85.10 }, { lat: 37.20, lon: -85.10 },
            { lat: 37.20, lon: -83.85 }, { lat: 36.90, lon: -83.85 },
          ],
          impactPath: [
            { lat: 37.02, lon: -85.03 }, { lat: 37.03, lon: -84.80 },
            { lat: 37.04, lon: -84.65 }, { lat: 37.05, lon: -84.55 },
            { lat: 37.06, lon: -84.40 }, { lat: 37.08, lon: -84.10 },
            { lat: 37.085, lon: -83.97 },
          ],
          predictedPath: [
            { lat: 37.06, lon: -84.40 },
            { lat: 37.07, lon: -84.25 },
            { lat: 37.08, lon: -84.10 },
          ],
        },
      ],
      shelters: [
        { name: 'Pilot Travel Center', type: 'TRUCK_STOP', distanceMiles: 3.2, hasIndoorShelter: true, exitNumber: '38' },
        { name: 'Shell Station', type: 'GAS_STATION', distanceMiles: 4.1, hasIndoorShelter: false, exitNumber: '41' },
      ],
      alternateRoute: {
        waypoints: [
          { lat: 37.05, lon: -84.10 },
          { lat: 37.08, lon: -83.95 },
          { lat: 37.15, lon: -83.90 },
          { lat: 37.25, lon: -84.00 },
          { lat: 37.35, lon: -84.15 },
        ],
        distanceMiles: 45,
        timeMinutes: 52,
        safetyScore: 0.85,
      },
      dangerZone: { startIndex: 45, endIndex: 60 },
      countdownMinutes: 22,
    },
    {
      minutesMark: 18,
      riskScore: 52,
      tier: 'ACTION_REQUIRED',
      alertMessage: 'TORNADO approaching I-75. Crossing your route in 14 minutes. EXIT at Exit 38 NOW. Pilot Travel Center has indoor shelter.',
      recommendedAction: 'EXIT_HIGHWAY',
      stormCells: [
        {
          lat: 37.06, lon: -84.35, radiusMiles: 14, severity: 'EXTREME', type: 'Tornado-Producing Supercell',
          pathWidthMiles: 1.0,
          warnPolygon: [
            { lat: 36.90, lon: -85.10 }, { lat: 37.20, lon: -85.10 },
            { lat: 37.20, lon: -83.85 }, { lat: 36.90, lon: -83.85 },
          ],
          impactPath: [
            { lat: 37.02, lon: -85.03 }, { lat: 37.03, lon: -84.80 },
            { lat: 37.04, lon: -84.65 }, { lat: 37.05, lon: -84.55 },
            { lat: 37.06, lon: -84.35 }, { lat: 37.08, lon: -84.10 },
            { lat: 37.085, lon: -83.97 },
          ],
          predictedPath: [
            { lat: 37.07, lon: -84.20 },
            { lat: 37.08, lon: -84.08 },
          ],
        },
      ],
      shelters: [
        { name: 'Pilot Travel Center', type: 'TRUCK_STOP', distanceMiles: 1.2, hasIndoorShelter: true, exitNumber: '38' },
      ],
      dangerZone: { startIndex: 45, endIndex: 60 },
      countdownMinutes: 14,
    },
    {
      minutesMark: 22,
      riskScore: 68,
      tier: 'ACTION_REQUIRED',
      alertMessage: 'TAKE EXIT 38 IMMEDIATELY. Pilot Travel Center indoor shelter 0.8 miles ahead on right. Tornado crossing I-75 in 8 minutes.',
      recommendedAction: 'EXIT_TO_SHELTER',
      stormCells: [
        {
          lat: 37.07, lon: -84.20, radiusMiles: 15, severity: 'EXTREME', type: 'EF-4 Tornado',
          pathWidthMiles: 1.0,
          warnPolygon: [
            { lat: 36.90, lon: -85.10 }, { lat: 37.20, lon: -85.10 },
            { lat: 37.20, lon: -83.85 }, { lat: 36.90, lon: -83.85 },
          ],
          impactPath: [
            { lat: 37.02, lon: -85.03 }, { lat: 37.03, lon: -84.80 },
            { lat: 37.04, lon: -84.65 }, { lat: 37.05, lon: -84.55 },
            { lat: 37.06, lon: -84.35 }, { lat: 37.07, lon: -84.20 },
            { lat: 37.08, lon: -84.10 }, { lat: 37.085, lon: -83.97 },
          ],
          predictedPath: [
            { lat: 37.08, lon: -84.10 },
          ],
        },
      ],
      shelters: [
        { name: 'Pilot Travel Center', type: 'TRUCK_STOP', distanceMiles: 0.8, hasIndoorShelter: true, exitNumber: '38' },
      ],
      dangerZone: { startIndex: 45, endIndex: 60 },
      countdownMinutes: 8,
    },
    {
      minutesMark: 25,
      riskScore: 85,
      tier: 'IMMEDIATE_DANGER',
      alertMessage: 'TORNADO DANGER. EXIT NOW or PULL OVER IMMEDIATELY. Seatbelt ON. Head below windows. Do NOT stop under overpass.',
      recommendedAction: 'TAKE_COVER',
      stormCells: [
        {
          lat: 37.08, lon: -84.10, radiusMiles: 16, severity: 'EXTREME', type: 'EF-4 Tornado On Ground',
          pathWidthMiles: 1.0,
          warnPolygon: [
            { lat: 36.90, lon: -85.10 }, { lat: 37.20, lon: -85.10 },
            { lat: 37.20, lon: -83.85 }, { lat: 36.90, lon: -83.85 },
          ],
          impactPath: [
            { lat: 37.02, lon: -85.03 }, { lat: 37.03, lon: -84.80 },
            { lat: 37.04, lon: -84.65 }, { lat: 37.05, lon: -84.55 },
            { lat: 37.06, lon: -84.35 }, { lat: 37.07, lon: -84.20 },
            { lat: 37.08, lon: -84.10 }, { lat: 37.085, lon: -83.97 },
          ],
        },
      ],
      shelters: [],
      dangerZone: { startIndex: 45, endIndex: 60 },
      countdownMinutes: 3,
    },
    {
      minutesMark: 28,
      riskScore: 95,
      tier: 'IMMEDIATE_DANGER',
      alertMessage: 'TORNADO ON YOUR HIGHWAY. TAKE COVER NOW. Stay buckled. Head below windows. Engine running.',
      recommendedAction: 'TAKE_COVER',
      stormCells: [
        {
          lat: 37.085, lon: -84.085, radiusMiles: 18, severity: 'EXTREME', type: 'EF-4 Tornado Crossing I-75',
          pathWidthMiles: 1.0,
          warnPolygon: [
            { lat: 36.90, lon: -85.10 }, { lat: 37.20, lon: -85.10 },
            { lat: 37.20, lon: -83.85 }, { lat: 36.90, lon: -83.85 },
          ],
          impactPath: [
            { lat: 37.02, lon: -85.03 }, { lat: 37.03, lon: -84.80 },
            { lat: 37.04, lon: -84.65 }, { lat: 37.05, lon: -84.55 },
            { lat: 37.06, lon: -84.35 }, { lat: 37.07, lon: -84.20 },
            { lat: 37.08, lon: -84.10 }, { lat: 37.085, lon: -83.97 },
          ],
        },
      ],
      shelters: [],
      dangerZone: { startIndex: 45, endIndex: 60 },
      countdownMinutes: 0,
    },
    {
      minutesMark: 32,
      riskScore: 45,
      tier: 'ACTION_REQUIRED',
      alertMessage: 'Tornado has passed your location. WARNING still active. Checking route ahead for debris and road damage. Reduce speed.',
      recommendedAction: 'REDUCE_SPEED',
      stormCells: [
        {
          lat: 37.09, lon: -83.95, radiusMiles: 14, severity: 'SEVERE', type: 'Tornado Moving Away',
          pathWidthMiles: 1.0,
          impactPath: [
            { lat: 37.02, lon: -85.03 }, { lat: 37.03, lon: -84.80 },
            { lat: 37.04, lon: -84.65 }, { lat: 37.05, lon: -84.55 },
            { lat: 37.06, lon: -84.35 }, { lat: 37.07, lon: -84.20 },
            { lat: 37.08, lon: -84.10 }, { lat: 37.085, lon: -83.97 },
          ],
        },
      ],
      shelters: [],
      dangerZone: null,
      countdownMinutes: null,
    },
    {
      minutesMark: 35,
      riskScore: 20,
      tier: 'ADVISORY',
      alertMessage: 'Tornado warning expired for your area. Possible debris on road ahead. Proceed with caution at reduced speed.',
      recommendedAction: 'CAUTION',
      stormCells: [
        {
          lat: 37.10, lon: -83.80, radiusMiles: 10, severity: 'MODERATE', type: 'Weakening Storm',
          pathWidthMiles: 1.0,
          impactPath: [
            { lat: 37.02, lon: -85.03 }, { lat: 37.03, lon: -84.80 },
            { lat: 37.04, lon: -84.65 }, { lat: 37.05, lon: -84.55 },
            { lat: 37.06, lon: -84.35 }, { lat: 37.07, lon: -84.20 },
            { lat: 37.08, lon: -84.10 }, { lat: 37.085, lon: -83.97 },
          ],
        },
      ],
      shelters: [],
      dangerZone: null,
      countdownMinutes: null,
    },
    {
      minutesMark: 38,
      riskScore: 5,
      tier: 'MONITORING',
      alertMessage: 'All clear. Resuming normal route monitoring. Drive safely.',
      recommendedAction: 'CONTINUE',
      stormCells: [],
      shelters: [],
      dangerZone: null,
      countdownMinutes: null,
    },
  ],
};
