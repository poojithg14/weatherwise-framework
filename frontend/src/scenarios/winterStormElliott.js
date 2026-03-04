// Winter Storm Elliott - December 2022
// Based on historic blizzard event on I-90 in Western NY
export default {
  id: 'winter-storm-elliott',
  name: 'Winter Storm Elliott',
  description: 'Historic lake-effect blizzard buries I-90 near Buffalo, NY with 50+ inches of snow and whiteout conditions.',
  hazardType: 'BLIZZARD',
  region: 'I-90 Corridor, Western NY',
  center: { lat: 42.89, lon: -78.88 },
  route: {
    from: { lat: 43.15, lon: -77.62, label: 'Rochester, NY' },
    to: { lat: 42.89, lon: -78.88, label: 'Buffalo, NY' },
  },
  timeline: [
    {
      minutesMark: 0,
      riskScore: 0.20,
      tier: 'MONITORING',
      alertMessage: 'Trip started. Blizzard warning in effect for Erie County. Lake-effect snow bands developing.',
      recommendedAction: 'CONTINUE_MONITORING',
      stormCells: [],
      shelters: [],
    },
    {
      minutesMark: 7,
      riskScore: 0.40,
      tier: 'ADVISORY',
      alertMessage: 'Heavy snow band setting up over I-90 near Batavia. Visibility dropping below 1/4 mile. Wind gusts 55 mph.',
      recommendedAction: 'CONTINUE_MONITORING',
      stormCells: [
        {
          id: 'band-1', lat: 43.00, lon: -78.20, velocityX: -5, velocityY: -2, hazardType: 'BLIZZARD',
          pathWidthMiles: 3.0,
          warnPolygon: [
            { lat: 42.70, lon: -79.10 }, { lat: 43.10, lon: -79.10 },
            { lat: 43.10, lon: -78.50 }, { lat: 42.70, lon: -78.50 },
          ],
          impactPath: [
            { lat: 43.05, lon: -78.40 }, { lat: 42.98, lon: -78.60 },
            { lat: 42.92, lon: -78.75 }, { lat: 42.89, lon: -78.88 },
          ],
        },
      ],
      shelters: [
        { name: 'Batavia Service Area', lat: 43.00, lon: -78.19, distanceMiles: 6.0, exitNumber: 48 },
      ],
    },
    {
      minutesMark: 15,
      riskScore: 0.60,
      tier: 'ACTION_REQUIRED',
      alertMessage: 'BLIZZARD WARNING: Zero visibility on I-90 west of Exit 48. Snowfall rate 4 in/hr. NYS Thruway Authority advising no travel.',
      recommendedAction: 'PREPARE_TO_EXIT',
      stormCells: [
        {
          id: 'band-1', lat: 42.95, lon: -78.40, velocityX: -3, velocityY: -1, hazardType: 'BLIZZARD',
          pathWidthMiles: 3.0,
          warnPolygon: [
            { lat: 42.70, lon: -79.10 }, { lat: 43.10, lon: -79.10 },
            { lat: 43.10, lon: -78.50 }, { lat: 42.70, lon: -78.50 },
          ],
          impactPath: [
            { lat: 43.05, lon: -78.40 }, { lat: 42.98, lon: -78.60 },
            { lat: 42.92, lon: -78.75 }, { lat: 42.89, lon: -78.88 },
          ],
        },
      ],
      shelters: [
        { name: 'Pembroke Service Area', lat: 43.00, lon: -78.30, distanceMiles: 3.2, exitNumber: '48A' },
        { name: 'Clarence Travel Plaza', lat: 42.98, lon: -78.60, distanceMiles: 8.5, exitNumber: 49 },
      ],
    },
    {
      minutesMark: 22,
      riskScore: 0.82,
      tier: 'ACTION_REQUIRED',
      alertMessage: 'TRAVEL BAN: Erie County declares driving ban effective immediately. Exit I-90 NOW. Vehicles becoming stranded.',
      recommendedAction: 'EXIT_HIGHWAY',
      stormCells: [
        {
          id: 'band-1', lat: 42.92, lon: -78.60, velocityX: -2, velocityY: 0, hazardType: 'BLIZZARD',
          pathWidthMiles: 3.0,
          warnPolygon: [
            { lat: 42.70, lon: -79.10 }, { lat: 43.10, lon: -79.10 },
            { lat: 43.10, lon: -78.50 }, { lat: 42.70, lon: -78.50 },
          ],
          impactPath: [
            { lat: 43.05, lon: -78.40 }, { lat: 42.98, lon: -78.60 },
            { lat: 42.92, lon: -78.75 }, { lat: 42.89, lon: -78.88 },
          ],
        },
      ],
      shelters: [
        { name: 'Clarence Travel Plaza', lat: 42.98, lon: -78.60, distanceMiles: 1.5, exitNumber: 49 },
        { name: 'Depew Fire Hall', lat: 42.91, lon: -78.70, distanceMiles: 3.0, exitNumber: 49 },
      ],
    },
    {
      minutesMark: 28,
      riskScore: 0.94,
      tier: 'IMMEDIATE_DANGER',
      alertMessage: 'LIFE-THREATENING BLIZZARD: Whiteout conditions. Do NOT leave your vehicle if stranded. Call 911. Run engine 10 min/hr, keep exhaust clear.',
      recommendedAction: 'SEEK_SHELTER',
      stormCells: [
        {
          id: 'band-1', lat: 42.90, lon: -78.75, velocityX: -1, velocityY: 0, hazardType: 'BLIZZARD',
          pathWidthMiles: 3.0,
          warnPolygon: [
            { lat: 42.70, lon: -79.10 }, { lat: 43.10, lon: -79.10 },
            { lat: 43.10, lon: -78.50 }, { lat: 42.70, lon: -78.50 },
          ],
          impactPath: [
            { lat: 43.05, lon: -78.40 }, { lat: 42.98, lon: -78.60 },
            { lat: 42.92, lon: -78.75 }, { lat: 42.89, lon: -78.88 },
          ],
        },
      ],
      shelters: [
        { name: 'Cheektowaga Community Center', lat: 42.90, lon: -78.76, distanceMiles: 2.0, exitNumber: 52 },
      ],
    },
    {
      minutesMark: 36,
      riskScore: 0.70,
      tier: 'ACTION_REQUIRED',
      alertMessage: 'Snow band shifting south. Plows working on I-90 eastbound lanes. Travel ban still in effect. Shelter in place.',
      recommendedAction: 'SEEK_SHELTER',
      stormCells: [],
      shelters: [],
    },
    {
      minutesMark: 44,
      riskScore: 0.40,
      tier: 'ADVISORY',
      alertMessage: 'Driving ban lifted for I-90. One lane passable. Expect significant delays and drifting snow.',
      recommendedAction: 'CONTINUE_MONITORING',
      stormCells: [],
      shelters: [],
    },
  ],
};
