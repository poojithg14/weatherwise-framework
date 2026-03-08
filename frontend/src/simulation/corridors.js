/**
 * 24 US highway corridors for multi-traveler simulation.
 * Geographically diverse — covers major interstates coast-to-coast.
 */
const CORRIDORS = [
  // Southeast
  { label: 'I-75: Lexington → Knoxville',        from: { lat: 37.83, lon: -84.36 }, to: { lat: 35.96, lon: -83.92 }, defaultSpeedMph: 70 },
  { label: 'I-65: Nashville → Birmingham',        from: { lat: 36.16, lon: -86.78 }, to: { lat: 33.52, lon: -86.81 }, defaultSpeedMph: 70 },
  { label: 'I-95: Jacksonville → Savannah',       from: { lat: 30.33, lon: -81.66 }, to: { lat: 32.08, lon: -81.09 }, defaultSpeedMph: 70 },
  { label: 'I-10: Tallahassee → Mobile',          from: { lat: 30.44, lon: -84.28 }, to: { lat: 30.69, lon: -88.04 }, defaultSpeedMph: 70 },

  // Tornado Alley / Central
  { label: 'I-44: Oklahoma City → Tulsa',         from: { lat: 35.47, lon: -97.52 }, to: { lat: 36.15, lon: -95.99 }, defaultSpeedMph: 75 },
  { label: 'I-35: Dallas → Oklahoma City',        from: { lat: 32.78, lon: -96.80 }, to: { lat: 35.47, lon: -97.52 }, defaultSpeedMph: 75 },
  { label: 'I-70: Kansas City → Topeka',          from: { lat: 39.10, lon: -94.58 }, to: { lat: 39.05, lon: -95.68 }, defaultSpeedMph: 70 },
  { label: 'I-55: Memphis → Jackson MS',          from: { lat: 35.15, lon: -90.05 }, to: { lat: 32.30, lon: -90.18 }, defaultSpeedMph: 70 },

  // Northeast
  { label: 'I-95: Philadelphia → New York',       from: { lat: 39.95, lon: -75.17 }, to: { lat: 40.71, lon: -74.01 }, defaultSpeedMph: 60 },
  { label: 'I-90: Albany → Syracuse',              from: { lat: 42.65, lon: -73.76 }, to: { lat: 43.05, lon: -76.15 }, defaultSpeedMph: 65 },
  { label: 'I-81: Harrisburg → Scranton',         from: { lat: 40.26, lon: -76.88 }, to: { lat: 41.41, lon: -75.66 }, defaultSpeedMph: 65 },
  { label: 'I-64: Louisville → Lexington',        from: { lat: 38.25, lon: -85.76 }, to: { lat: 38.04, lon: -84.50 }, defaultSpeedMph: 70 },

  // Midwest
  { label: 'I-80: Des Moines → Omaha',            from: { lat: 41.59, lon: -93.62 }, to: { lat: 41.26, lon: -95.94 }, defaultSpeedMph: 75 },
  { label: 'I-94: Minneapolis → Madison',         from: { lat: 44.98, lon: -93.27 }, to: { lat: 43.07, lon: -89.40 }, defaultSpeedMph: 70 },
  { label: 'I-69: Indianapolis → Fort Wayne',     from: { lat: 39.77, lon: -86.16 }, to: { lat: 41.08, lon: -85.14 }, defaultSpeedMph: 70 },
  { label: 'I-57: Chicago → Champaign',           from: { lat: 41.88, lon: -87.63 }, to: { lat: 40.12, lon: -88.24 }, defaultSpeedMph: 70 },

  // West / Mountain
  { label: 'I-25: Denver → Colorado Springs',     from: { lat: 39.74, lon: -104.99 }, to: { lat: 38.83, lon: -104.82 }, defaultSpeedMph: 75 },
  { label: 'I-15: Salt Lake City → Provo',        from: { lat: 40.76, lon: -111.89 }, to: { lat: 40.23, lon: -111.66 }, defaultSpeedMph: 70 },
  { label: 'I-40: Albuquerque → Amarillo',        from: { lat: 35.08, lon: -106.65 }, to: { lat: 35.22, lon: -101.83 }, defaultSpeedMph: 75 },
  { label: 'I-10: Tucson → Phoenix',              from: { lat: 32.22, lon: -110.97 }, to: { lat: 33.45, lon: -112.07 }, defaultSpeedMph: 75 },

  // Pacific / Gulf Coast
  { label: 'I-5: Portland → Salem',               from: { lat: 45.52, lon: -122.68 }, to: { lat: 44.94, lon: -123.03 }, defaultSpeedMph: 65 },
  { label: 'I-5: Sacramento → Stockton',          from: { lat: 38.58, lon: -121.49 }, to: { lat: 37.96, lon: -121.29 }, defaultSpeedMph: 65 },
  { label: 'I-10: Houston → San Antonio',         from: { lat: 29.76, lon: -95.37 }, to: { lat: 29.42, lon: -98.49 }, defaultSpeedMph: 75 },
  { label: 'I-20: Shreveport → Dallas',           from: { lat: 32.53, lon: -93.75 }, to: { lat: 32.78, lon: -96.80 }, defaultSpeedMph: 75 },
];

export default CORRIDORS;
