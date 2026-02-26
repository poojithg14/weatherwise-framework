// Hurricane Helene - September 2024 Remnants
// Based on I-40 through Western NC flooding event
export default {
  id: 'hurricane-helene',
  name: 'Hurricane Helene Remnants',
  description: 'Catastrophic flooding from Hurricane Helene remnants across I-40 in Western North Carolina.',
  hazardType: 'FLASH_FLOOD',
  region: 'I-40 Corridor, Western NC',
  center: { lat: 35.59, lon: -82.55 },
  route: {
    from: { lat: 35.96, lon: -83.95, label: 'Knoxville, TN' },
    to: { lat: 35.59, lon: -82.55, label: 'Asheville, NC' },
  },
  timeline: [
    {
      minutesMark: 0,
      riskScore: 0.20,
      tier: 'MONITORING',
      alertMessage: 'Trip started. Heavy rain from Hurricane Helene remnants expected. Flash flood watch in effect.',
      recommendedAction: 'CONTINUE_MONITORING',
      stormCells: [],
      shelters: [],
    },
    {
      minutesMark: 6,
      riskScore: 0.35,
      tier: 'ADVISORY',
      alertMessage: 'Rainfall rates exceeding 2 inches/hour in Buncombe County. Visibility reduced on I-40.',
      recommendedAction: 'CONTINUE_MONITORING',
      stormCells: [
        {
          id: 'rain-1', lat: 35.70, lon: -82.80, velocityX: 5, velocityY: -2, hazardType: 'FLASH_FLOOD',
          pathWidthMiles: 2.0,
          warnPolygon: [
            { lat: 35.40, lon: -82.80 }, { lat: 35.75, lon: -82.80 },
            { lat: 35.75, lon: -82.30 }, { lat: 35.40, lon: -82.30 },
          ],
          impactPath: [
            { lat: 35.50, lon: -82.65 }, { lat: 35.55, lon: -82.58 },
            { lat: 35.59, lon: -82.55 }, { lat: 35.65, lon: -82.45 },
          ],
        },
      ],
      shelters: [],
    },
    {
      minutesMark: 14,
      riskScore: 0.55,
      tier: 'ACTION_REQUIRED',
      alertMessage: 'FLASH FLOOD WARNING: Swannanoa River rising rapidly. Water reported on I-40 near Exit 55.',
      recommendedAction: 'PREPARE_TO_EXIT',
      stormCells: [
        {
          id: 'rain-1', lat: 35.65, lon: -82.70, velocityX: 3, velocityY: -1, hazardType: 'FLASH_FLOOD',
          pathWidthMiles: 2.0,
          warnPolygon: [
            { lat: 35.40, lon: -82.80 }, { lat: 35.75, lon: -82.80 },
            { lat: 35.75, lon: -82.30 }, { lat: 35.40, lon: -82.30 },
          ],
          impactPath: [
            { lat: 35.50, lon: -82.65 }, { lat: 35.55, lon: -82.58 },
            { lat: 35.59, lon: -82.55 }, { lat: 35.65, lon: -82.45 },
          ],
        },
      ],
      shelters: [
        { name: 'Black Mountain Rest Stop', lat: 35.62, lon: -82.32, distanceMiles: 4.2, exitNumber: 64 },
      ],
    },
    {
      minutesMark: 20,
      riskScore: 0.78,
      tier: 'ACTION_REQUIRED',
      alertMessage: 'FLASH FLOOD EMERGENCY: I-40 flooded and impassable near Swannanoa. Multiple road closures. Exit at next available exit.',
      recommendedAction: 'EXIT_HIGHWAY',
      stormCells: [
        {
          id: 'rain-1', lat: 35.60, lon: -82.60, velocityX: 2, velocityY: 0, hazardType: 'FLASH_FLOOD',
          pathWidthMiles: 2.0,
          warnPolygon: [
            { lat: 35.40, lon: -82.80 }, { lat: 35.75, lon: -82.80 },
            { lat: 35.75, lon: -82.30 }, { lat: 35.40, lon: -82.30 },
          ],
          impactPath: [
            { lat: 35.50, lon: -82.65 }, { lat: 35.55, lon: -82.58 },
            { lat: 35.59, lon: -82.55 }, { lat: 35.65, lon: -82.45 },
          ],
        },
      ],
      shelters: [
        { name: 'Old Fort Community Center', lat: 35.63, lon: -82.17, distanceMiles: 2.8, exitNumber: 72 },
        { name: 'Marion Civic Center', lat: 35.66, lon: -82.00, distanceMiles: 8.5, exitNumber: 85 },
      ],
      alternateRoute: {
        description: 'Exit 72 → US-70 to Old Fort, wait for conditions to improve',
        waypoints: [
          { lat: 35.63, lon: -82.17 },
          { lat: 35.62, lon: -82.23 },
        ],
      },
    },
    {
      minutesMark: 28,
      riskScore: 0.92,
      tier: 'IMMEDIATE_DANGER',
      alertMessage: 'LIFE-THREATENING FLASH FLOODING: Do NOT attempt to cross flooded roadways. Seek high ground immediately. Multiple landslides reported.',
      recommendedAction: 'SEEK_SHELTER',
      stormCells: [
        {
          id: 'rain-1', lat: 35.58, lon: -82.55, velocityX: 1, velocityY: 0, hazardType: 'FLASH_FLOOD',
          pathWidthMiles: 2.0,
          warnPolygon: [
            { lat: 35.40, lon: -82.80 }, { lat: 35.75, lon: -82.80 },
            { lat: 35.75, lon: -82.30 }, { lat: 35.40, lon: -82.30 },
          ],
          impactPath: [
            { lat: 35.50, lon: -82.65 }, { lat: 35.55, lon: -82.58 },
            { lat: 35.59, lon: -82.55 }, { lat: 35.65, lon: -82.45 },
          ],
        },
      ],
      shelters: [
        { name: 'Old Fort Community Center', lat: 35.63, lon: -82.17, distanceMiles: 1.5, exitNumber: 72 },
      ],
    },
    {
      minutesMark: 35,
      riskScore: 0.70,
      tier: 'ACTION_REQUIRED',
      alertMessage: 'Rain intensity decreasing but rivers still rising. I-40 closed in both directions between exits 55-72. Shelter in place until all-clear.',
      recommendedAction: 'SEEK_SHELTER',
      stormCells: [],
      shelters: [],
    },
    {
      minutesMark: 42,
      riskScore: 0.45,
      tier: 'ADVISORY',
      alertMessage: 'Flash flood warning continues. Some secondary roads reopening. Follow NCDOT detour signs.',
      recommendedAction: 'CONTINUE_MONITORING',
      stormCells: [],
      shelters: [],
    },
  ],
};
