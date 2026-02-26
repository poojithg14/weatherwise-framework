export { default as londonKyTornado } from './londonKyTornado';
export { default as hurricaneHelene } from './hurricaneHelene';
export { default as texasFlashFlood } from './texasFlashFlood';
export { default as winterStormElliott } from './winterStormElliott';
export { default as oregonWildfireSmoke } from './oregonWildfireSmoke';
export { default as multiHazard } from './multiHazard';
export { default as allClear } from './allClear';

export const scenarios = [
  { module: () => import('./londonKyTornado'), id: 'london-ky-tornado', name: 'London KY EF-4 Tornado', hazard: 'TORNADO' },
  { module: () => import('./hurricaneHelene'), id: 'hurricane-helene', name: 'Hurricane Helene Remnants', hazard: 'FLASH_FLOOD' },
  { module: () => import('./texasFlashFlood'), id: 'texas-flash-flood', name: 'Texas Hill Country Flash Flood', hazard: 'FLASH_FLOOD' },
  { module: () => import('./winterStormElliott'), id: 'winter-storm-elliott', name: 'Winter Storm Elliott', hazard: 'BLIZZARD' },
  { module: () => import('./oregonWildfireSmoke'), id: 'oregon-wildfire-smoke', name: 'Oregon Wildfire Smoke', hazard: 'WILDFIRE' },
  { module: () => import('./multiHazard'), id: 'multi-hazard', name: 'Multi-Hazard: Tropical Storm', hazard: 'MULTIPLE' },
  { module: () => import('./allClear'), id: 'all-clear', name: 'All Clear - Normal', hazard: 'NONE' },
];
