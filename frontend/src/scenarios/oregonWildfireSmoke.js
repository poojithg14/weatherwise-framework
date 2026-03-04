// Oregon Wildfire Smoke - I-5 Corridor
// Based on 2020 Labor Day fires that shut down I-5
export default {
  id: 'oregon-wildfire-smoke',
  name: 'Oregon Wildfire Smoke Event',
  description: 'Catastrophic wildfire smoke blankets I-5 corridor through Willamette Valley with AQI exceeding 500.',
  hazardType: 'WILDFIRE',
  region: 'I-5 Corridor, Oregon',
  center: { lat: 44.05, lon: -123.09 },
  route: {
    from: { lat: 45.52, lon: -122.68, label: 'Portland, OR' },
    to: { lat: 44.05, lon: -123.09, label: 'Eugene, OR' },
  },
  timeline: [
    {
      minutesMark: 0,
      riskScore: 0.15,
      tier: 'MONITORING',
      alertMessage: 'Trip started. Air quality alerts issued for Willamette Valley. AQI 150 (Unhealthy).',
      recommendedAction: 'CONTINUE_MONITORING',
      stormCells: [],
      shelters: [],
    },
    {
      minutesMark: 8,
      riskScore: 0.35,
      tier: 'ADVISORY',
      alertMessage: 'Smoke thickening south of Salem. AQI 280 (Very Unhealthy). Visibility 2 miles. Close vehicle vents and use recirculate.',
      recommendedAction: 'CONTINUE_MONITORING',
      stormCells: [
        {
          id: 'fire-1', lat: 44.60, lon: -122.50, velocityX: -8, velocityY: 3, hazardType: 'WILDFIRE',
          pathWidthMiles: 5.0,
          warnPolygon: [
            { lat: 44.20, lon: -123.20 }, { lat: 44.95, lon: -123.20 },
            { lat: 44.95, lon: -122.90 }, { lat: 44.20, lon: -122.90 },
          ],
          impactPath: [
            { lat: 44.90, lon: -123.05 }, { lat: 44.70, lon: -123.08 },
            { lat: 44.50, lon: -123.10 }, { lat: 44.30, lon: -123.08 },
          ],
        },
      ],
      shelters: [],
    },
    {
      minutesMark: 16,
      riskScore: 0.55,
      tier: 'ACTION_REQUIRED',
      alertMessage: 'HAZARDOUS AIR QUALITY: AQI 420 near Albany. Visibility below 1/2 mile. Wildfire approaching I-5 near Santiam Pass junction.',
      recommendedAction: 'PREPARE_TO_EXIT',
      stormCells: [
        {
          id: 'fire-1', lat: 44.55, lon: -122.60, velocityX: -6, velocityY: 2, hazardType: 'WILDFIRE',
          pathWidthMiles: 5.0,
          warnPolygon: [
            { lat: 44.20, lon: -123.20 }, { lat: 44.95, lon: -123.20 },
            { lat: 44.95, lon: -122.90 }, { lat: 44.20, lon: -122.90 },
          ],
          impactPath: [
            { lat: 44.90, lon: -123.05 }, { lat: 44.70, lon: -123.08 },
            { lat: 44.50, lon: -123.10 }, { lat: 44.30, lon: -123.08 },
          ],
        },
        {
          id: 'fire-2', lat: 44.30, lon: -122.40, velocityX: -10, velocityY: 5, hazardType: 'WILDFIRE',
          pathWidthMiles: 5.0,
          impactPath: [
            { lat: 44.50, lon: -123.10 }, { lat: 44.30, lon: -123.08 },
          ],
        },
      ],
      shelters: [
        { name: 'Albany Civic Center', lat: 44.63, lon: -123.10, distanceMiles: 3.0, exitNumber: 234 },
        { name: 'Linn County Fairgrounds', lat: 44.62, lon: -123.12, distanceMiles: 4.5, exitNumber: 233 },
      ],
    },
    {
      minutesMark: 22,
      riskScore: 0.73,
      tier: 'ACTION_REQUIRED',
      alertMessage: 'I-5 CLOSURE: ODOT closing I-5 between exits 216-228 due to active fire crossing highway. Mandatory evacuation east side.',
      recommendedAction: 'EXIT_HIGHWAY',
      stormCells: [
        {
          id: 'fire-2', lat: 44.35, lon: -122.70, velocityX: -8, velocityY: 3, hazardType: 'WILDFIRE',
          pathWidthMiles: 5.0,
          warnPolygon: [
            { lat: 44.20, lon: -123.20 }, { lat: 44.95, lon: -123.20 },
            { lat: 44.95, lon: -122.90 }, { lat: 44.20, lon: -122.90 },
          ],
          impactPath: [
            { lat: 44.90, lon: -123.05 }, { lat: 44.70, lon: -123.08 },
            { lat: 44.50, lon: -123.10 }, { lat: 44.30, lon: -123.08 },
          ],
        },
      ],
      shelters: [
        { name: 'Albany Civic Center', lat: 44.63, lon: -123.10, distanceMiles: 1.5, exitNumber: 234 },
      ],
      alternateRoute: {
        description: 'Exit 234 → OR-99W through Corvallis (west of fire zone)',
        waypoints: [
          { lat: 44.63, lon: -123.10 },
          { lat: 44.40, lon: -123.26 },
          { lat: 44.05, lon: -123.09 },
        ],
      },
    },
    {
      minutesMark: 28,
      riskScore: 0.88,
      tier: 'IMMEDIATE_DANGER',
      alertMessage: 'FIRE DANGER: Embers spotting across I-5. AQI 550+. Do NOT proceed south on I-5. Use OR-99W alternate immediately.',
      recommendedAction: 'USE_ALTERNATE_ROUTE',
      stormCells: [
        {
          id: 'fire-2', lat: 44.30, lon: -122.90, velocityX: -5, velocityY: 2, hazardType: 'WILDFIRE',
          pathWidthMiles: 5.0,
          warnPolygon: [
            { lat: 44.20, lon: -123.20 }, { lat: 44.95, lon: -123.20 },
            { lat: 44.95, lon: -122.90 }, { lat: 44.20, lon: -122.90 },
          ],
          impactPath: [
            { lat: 44.90, lon: -123.05 }, { lat: 44.70, lon: -123.08 },
            { lat: 44.50, lon: -123.10 }, { lat: 44.30, lon: -123.08 },
          ],
        },
      ],
      shelters: [
        { name: 'Corvallis Convention Center', lat: 44.56, lon: -123.26, distanceMiles: 8.0, exitNumber: null },
      ],
    },
    {
      minutesMark: 36,
      riskScore: 0.55,
      tier: 'ACTION_REQUIRED',
      alertMessage: 'Wind shift pushing smoke east. OR-99W passable with reduced visibility. AQI improving to 250 on alternate route.',
      recommendedAction: 'CONTINUE_MONITORING',
      stormCells: [],
      shelters: [],
    },
    {
      minutesMark: 42,
      riskScore: 0.30,
      tier: 'ADVISORY',
      alertMessage: 'Approaching Eugene via OR-99W. AQI 180. I-5 remains closed. Alternate route successful.',
      recommendedAction: 'CONTINUE_MONITORING',
      stormCells: [],
      shelters: [],
    },
  ],
};
