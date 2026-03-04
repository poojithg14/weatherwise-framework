// Texas Flash Flood - I-35 Austin to San Antonio
// Based on common Hill Country flash flood events
export default {
  id: 'texas-flash-flood',
  name: 'Texas Hill Country Flash Flood',
  description: 'Sudden flash flooding along I-35 between Austin and San Antonio from training thunderstorms.',
  hazardType: 'FLASH_FLOOD',
  region: 'I-35 Corridor, Central Texas',
  center: { lat: 29.88, lon: -97.94 },
  route: {
    from: { lat: 30.27, lon: -97.74, label: 'Austin, TX' },
    to: { lat: 29.42, lon: -98.49, label: 'San Antonio, TX' },
  },
  timeline: [
    {
      minutesMark: 0,
      riskScore: 0.10,
      tier: 'MONITORING',
      alertMessage: 'Trip started. Scattered thunderstorms developing over Hill Country.',
      recommendedAction: 'CONTINUE_MONITORING',
      stormCells: [],
      shelters: [],
    },
    {
      minutesMark: 8,
      riskScore: 0.30,
      tier: 'ADVISORY',
      alertMessage: 'Flash flood watch issued for Hays and Comal counties. Storms training over Blanco River watershed.',
      recommendedAction: 'CONTINUE_MONITORING',
      stormCells: [
        {
          id: 'cell-1', lat: 30.05, lon: -98.10, velocityX: -3, velocityY: 2, hazardType: 'FLASH_FLOOD',
          pathWidthMiles: 1.5,
          warnPolygon: [
            { lat: 29.70, lon: -98.10 }, { lat: 30.00, lon: -98.10 },
            { lat: 30.00, lon: -97.70 }, { lat: 29.70, lon: -97.70 },
          ],
          impactPath: [
            { lat: 29.80, lon: -97.95 }, { lat: 29.84, lon: -97.90 },
            { lat: 29.88, lon: -97.85 }, { lat: 29.90, lon: -97.80 },
          ],
        },
      ],
      shelters: [],
    },
    {
      minutesMark: 16,
      riskScore: 0.58,
      tier: 'ACTION_REQUIRED',
      alertMessage: 'FLASH FLOOD WARNING: Blanco River at record crest. Water rising over low-water crossings near San Marcos.',
      recommendedAction: 'PREPARE_TO_EXIT',
      stormCells: [
        {
          id: 'cell-1', lat: 29.95, lon: -98.00, velocityX: -2, velocityY: 1, hazardType: 'FLASH_FLOOD',
          pathWidthMiles: 1.5,
          warnPolygon: [
            { lat: 29.70, lon: -98.10 }, { lat: 30.00, lon: -98.10 },
            { lat: 30.00, lon: -97.70 }, { lat: 29.70, lon: -97.70 },
          ],
          impactPath: [
            { lat: 29.80, lon: -97.95 }, { lat: 29.84, lon: -97.90 },
            { lat: 29.88, lon: -97.85 }, { lat: 29.90, lon: -97.80 },
          ],
        },
        {
          id: 'cell-2', lat: 29.88, lon: -97.90, velocityX: -5, velocityY: 3, hazardType: 'FLASH_FLOOD',
          pathWidthMiles: 1.5,
          impactPath: [
            { lat: 29.80, lon: -97.95 }, { lat: 29.85, lon: -97.90 },
            { lat: 29.90, lon: -97.80 },
          ],
        },
      ],
      shelters: [
        { name: 'San Marcos Premium Outlets', lat: 29.84, lon: -97.97, distanceMiles: 2.1, exitNumber: 200 },
        { name: 'Texas State University Rec Center', lat: 29.88, lon: -97.94, distanceMiles: 3.5, exitNumber: 205 },
      ],
    },
    {
      minutesMark: 22,
      riskScore: 0.75,
      tier: 'ACTION_REQUIRED',
      alertMessage: 'I-35 frontage road flooded near Exit 193. Main lanes passable but standing water in right lane. Reduce speed.',
      recommendedAction: 'EXIT_HIGHWAY',
      stormCells: [
        {
          id: 'cell-1', lat: 29.88, lon: -97.94, velocityX: -2, velocityY: 1, hazardType: 'FLASH_FLOOD',
          pathWidthMiles: 1.5,
          warnPolygon: [
            { lat: 29.70, lon: -98.10 }, { lat: 30.00, lon: -98.10 },
            { lat: 30.00, lon: -97.70 }, { lat: 29.70, lon: -97.70 },
          ],
          impactPath: [
            { lat: 29.80, lon: -97.95 }, { lat: 29.84, lon: -97.90 },
            { lat: 29.88, lon: -97.85 }, { lat: 29.90, lon: -97.80 },
          ],
        },
      ],
      shelters: [
        { name: 'New Braunfels Civic Center', lat: 29.70, lon: -98.12, distanceMiles: 4.0, exitNumber: 189 },
      ],
      alternateRoute: {
        description: 'Exit 200 → TX-130 toll road (higher elevation bypass)',
        waypoints: [
          { lat: 29.88, lon: -97.80 },
          { lat: 29.70, lon: -97.85 },
          { lat: 29.50, lon: -98.30 },
        ],
      },
    },
    {
      minutesMark: 28,
      riskScore: 0.85,
      tier: 'IMMEDIATE_DANGER',
      alertMessage: 'TURN AROUND DON\'T DROWN! I-35 impassable between exits 187-193. Flash flooding across all lanes. Seek high ground.',
      recommendedAction: 'SEEK_SHELTER',
      stormCells: [
        {
          id: 'cell-1', lat: 29.82, lon: -97.92, velocityX: -1, velocityY: 0, hazardType: 'FLASH_FLOOD',
          pathWidthMiles: 1.5,
          warnPolygon: [
            { lat: 29.70, lon: -98.10 }, { lat: 30.00, lon: -98.10 },
            { lat: 30.00, lon: -97.70 }, { lat: 29.70, lon: -97.70 },
          ],
          impactPath: [
            { lat: 29.80, lon: -97.95 }, { lat: 29.84, lon: -97.90 },
            { lat: 29.88, lon: -97.85 }, { lat: 29.90, lon: -97.80 },
          ],
        },
      ],
      shelters: [
        { name: 'New Braunfels Civic Center', lat: 29.70, lon: -98.12, distanceMiles: 1.8, exitNumber: 189 },
      ],
    },
    {
      minutesMark: 35,
      riskScore: 0.50,
      tier: 'ACTION_REQUIRED',
      alertMessage: 'Water receding on I-35. North lanes reopening at Exit 193. Proceed slowly — debris on road.',
      recommendedAction: 'CONTINUE_MONITORING',
      stormCells: [],
      shelters: [],
    },
    {
      minutesMark: 40,
      riskScore: 0.25,
      tier: 'ADVISORY',
      alertMessage: 'Flash flood warning expiring. Roads clearing. Resume normal travel with caution.',
      recommendedAction: 'CONTINUE_MONITORING',
      stormCells: [],
      shelters: [],
    },
  ],
};
