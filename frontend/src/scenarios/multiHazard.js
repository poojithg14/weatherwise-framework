// Multi-Hazard Scenario - I-10 Louisiana
// Tropical storm with tornado + flooding + wind
export default {
  id: 'multi-hazard',
  name: 'Multi-Hazard: Tropical Storm',
  description: 'Tropical storm makes landfall along I-10 Louisiana coast, producing tornadoes, flooding, and destructive winds simultaneously.',
  hazardType: 'MULTIPLE',
  region: 'I-10 Corridor, Louisiana',
  center: { lat: 30.22, lon: -92.02 },
  route: {
    from: { lat: 30.45, lon: -91.19, label: 'Baton Rouge, LA' },
    to: { lat: 30.22, lon: -93.22, label: 'Lake Charles, LA' },
  },
  timeline: [
    {
      minutesMark: 0,
      riskScore: 0.25,
      tier: 'ADVISORY',
      alertMessage: 'Tropical Storm Warning in effect for coastal Louisiana. Outer bands approaching I-10 corridor.',
      recommendedAction: 'CONTINUE_MONITORING',
      stormCells: [
        {
          id: 'band-1', lat: 29.90, lon: -91.80, velocityX: -12, velocityY: 5, hazardType: 'SEVERE_THUNDERSTORM',
          pathWidthMiles: 2.0,
          warnPolygon: [
            { lat: 29.80, lon: -92.80 }, { lat: 30.40, lon: -92.80 },
            { lat: 30.40, lon: -91.40 }, { lat: 29.80, lon: -91.40 },
          ],
          impactPath: [
            { lat: 30.30, lon: -91.60 }, { lat: 30.22, lon: -92.00 },
            { lat: 30.20, lon: -92.40 }, { lat: 30.22, lon: -92.65 },
          ],
        },
      ],
      shelters: [],
    },
    {
      minutesMark: 8,
      riskScore: 0.45,
      tier: 'ADVISORY',
      alertMessage: 'First outer band crossing I-10 near Lafayette. Heavy rain with wind gusts 50 mph. Hydroplaning risk HIGH.',
      recommendedAction: 'CONTINUE_MONITORING',
      stormCells: [
        {
          id: 'band-1', lat: 30.10, lon: -92.00, velocityX: -10, velocityY: 3, hazardType: 'SEVERE_THUNDERSTORM',
          pathWidthMiles: 2.0,
          warnPolygon: [
            { lat: 29.80, lon: -92.80 }, { lat: 30.40, lon: -92.80 },
            { lat: 30.40, lon: -91.40 }, { lat: 29.80, lon: -91.40 },
          ],
          impactPath: [
            { lat: 30.30, lon: -91.60 }, { lat: 30.22, lon: -92.00 },
            { lat: 30.20, lon: -92.40 }, { lat: 30.22, lon: -92.65 },
          ],
        },
        {
          id: 'band-2', lat: 29.80, lon: -91.50, velocityX: -15, velocityY: 8, hazardType: 'FLASH_FLOOD',
          pathWidthMiles: 1.5,
          impactPath: [
            { lat: 30.10, lon: -91.80 }, { lat: 30.05, lon: -92.10 },
            { lat: 30.00, lon: -92.40 },
          ],
        },
      ],
      shelters: [
        { name: 'Lafayette Cajundome', lat: 30.22, lon: -92.02, distanceMiles: 5.0, exitNumber: 103 },
      ],
    },
    {
      minutesMark: 14,
      riskScore: 0.65,
      tier: 'ACTION_REQUIRED',
      alertMessage: 'TORNADO WARNING: Rotation detected in outer band. Tornado possible near Crowley. Also flash flood warning for Acadia Parish.',
      recommendedAction: 'PREPARE_TO_EXIT',
      stormCells: [
        {
          id: 'band-1', lat: 30.20, lon: -92.20, velocityX: -10, velocityY: 3, hazardType: 'TORNADO', rotation: 20,
          pathWidthMiles: 2.0,
          warnPolygon: [
            { lat: 29.80, lon: -92.80 }, { lat: 30.40, lon: -92.80 },
            { lat: 30.40, lon: -91.40 }, { lat: 29.80, lon: -91.40 },
          ],
          impactPath: [
            { lat: 30.30, lon: -91.60 }, { lat: 30.22, lon: -92.00 },
            { lat: 30.20, lon: -92.20 }, { lat: 30.20, lon: -92.40 },
            { lat: 30.22, lon: -92.65 },
          ],
        },
        {
          id: 'band-2', lat: 30.05, lon: -92.10, velocityX: -8, velocityY: 2, hazardType: 'FLASH_FLOOD',
          pathWidthMiles: 1.5,
          impactPath: [
            { lat: 30.10, lon: -91.80 }, { lat: 30.05, lon: -92.10 },
            { lat: 30.00, lon: -92.40 },
          ],
        },
      ],
      shelters: [
        { name: 'Crowley City Hall', lat: 30.21, lon: -92.44, distanceMiles: 2.5, exitNumber: 80 },
        { name: 'Rayne Community Center', lat: 30.23, lon: -92.27, distanceMiles: 6.0, exitNumber: 87 },
      ],
    },
    {
      minutesMark: 20,
      riskScore: 0.82,
      tier: 'ACTION_REQUIRED',
      alertMessage: 'MULTIPLE HAZARDS: Confirmed tornado 3 miles south of I-10 AND flash flooding on frontage roads. Exit at Jennings (Exit 64) for sturdy shelter.',
      recommendedAction: 'EXIT_HIGHWAY',
      stormCells: [
        {
          id: 'band-1', lat: 30.18, lon: -92.40, velocityX: -8, velocityY: 2, hazardType: 'TORNADO', rotation: 30,
          pathWidthMiles: 2.0,
          warnPolygon: [
            { lat: 29.80, lon: -92.80 }, { lat: 30.40, lon: -92.80 },
            { lat: 30.40, lon: -91.40 }, { lat: 29.80, lon: -91.40 },
          ],
          impactPath: [
            { lat: 30.30, lon: -91.60 }, { lat: 30.22, lon: -92.00 },
            { lat: 30.20, lon: -92.20 }, { lat: 30.18, lon: -92.40 },
            { lat: 30.22, lon: -92.65 },
          ],
        },
        {
          id: 'band-2', lat: 30.15, lon: -92.30, velocityX: -5, velocityY: 1, hazardType: 'FLASH_FLOOD',
          pathWidthMiles: 1.5,
          impactPath: [
            { lat: 30.10, lon: -91.80 }, { lat: 30.05, lon: -92.10 },
            { lat: 30.00, lon: -92.40 },
          ],
        },
        {
          id: 'wind-1', lat: 30.10, lon: -92.50, velocityX: -12, velocityY: 4, hazardType: 'SEVERE_THUNDERSTORM',
          pathWidthMiles: 3.0,
          impactPath: [
            { lat: 30.15, lon: -92.30 }, { lat: 30.10, lon: -92.50 },
            { lat: 30.05, lon: -92.70 },
          ],
        },
      ],
      shelters: [
        { name: 'Jennings High School Gym', lat: 30.22, lon: -92.66, distanceMiles: 1.2, exitNumber: 64 },
      ],
    },
    {
      minutesMark: 26,
      riskScore: 0.93,
      tier: 'IMMEDIATE_DANGER',
      alertMessage: 'TAKE SHELTER NOW! Tornado crossing I-10 at Exit 59. Destructive winds 90+ mph in eyewall approaching. Seek interior room of sturdy building.',
      recommendedAction: 'SEEK_SHELTER',
      stormCells: [
        {
          id: 'band-1', lat: 30.22, lon: -92.65, velocityX: -8, velocityY: 1, hazardType: 'TORNADO', rotation: 40,
          pathWidthMiles: 2.0,
          warnPolygon: [
            { lat: 29.80, lon: -92.80 }, { lat: 30.40, lon: -92.80 },
            { lat: 30.40, lon: -91.40 }, { lat: 29.80, lon: -91.40 },
          ],
          impactPath: [
            { lat: 30.30, lon: -91.60 }, { lat: 30.22, lon: -92.00 },
            { lat: 30.20, lon: -92.20 }, { lat: 30.18, lon: -92.40 },
            { lat: 30.22, lon: -92.65 },
          ],
        },
        {
          id: 'wind-1', lat: 30.15, lon: -92.70, velocityX: -10, velocityY: 2, hazardType: 'SEVERE_THUNDERSTORM',
          pathWidthMiles: 3.0,
          impactPath: [
            { lat: 30.15, lon: -92.30 }, { lat: 30.10, lon: -92.50 },
            { lat: 30.05, lon: -92.70 },
          ],
        },
      ],
      shelters: [
        { name: 'Jennings High School Gym', lat: 30.22, lon: -92.66, distanceMiles: 0.5, exitNumber: 64 },
      ],
    },
    {
      minutesMark: 34,
      riskScore: 0.60,
      tier: 'ACTION_REQUIRED',
      alertMessage: 'Eye passing over. Brief calm. Do NOT resume travel — back side of storm approaching with more tornadoes and flooding.',
      recommendedAction: 'SEEK_SHELTER',
      stormCells: [
        {
          id: 'band-3', lat: 30.00, lon: -92.80, velocityX: -10, velocityY: 5, hazardType: 'SEVERE_THUNDERSTORM',
          pathWidthMiles: 3.0,
          impactPath: [
            { lat: 30.10, lon: -92.50 }, { lat: 30.00, lon: -92.80 },
            { lat: 29.90, lon: -93.00 },
          ],
        },
      ],
      shelters: [],
    },
    {
      minutesMark: 42,
      riskScore: 0.40,
      tier: 'ADVISORY',
      alertMessage: 'Storm moving inland. Winds decreasing to 40 mph. Flooding still present. Wait for official all-clear before resuming travel.',
      recommendedAction: 'CONTINUE_MONITORING',
      stormCells: [],
      shelters: [],
    },
  ],
};
