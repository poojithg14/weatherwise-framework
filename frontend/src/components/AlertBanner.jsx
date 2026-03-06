import { useState, useEffect } from 'react';

const tierStyles = {
  MONITORING: {
    bg: 'bg-green-900/80 border-green-600',
    icon: (
      <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    text: 'text-green-200',
    label: 'ALL CLEAR',
  },
  ADVISORY: {
    bg: 'bg-yellow-900/80 border-yellow-600',
    icon: (
      <svg className="w-5 h-5 text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    text: 'text-yellow-200',
    label: 'ADVISORY',
  },
  ACTION_REQUIRED: {
    bg: 'bg-orange-900/80 border-orange-500',
    icon: (
      <svg className="w-5 h-5 text-orange-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    ),
    text: 'text-orange-200',
    label: 'ACTION REQUIRED',
  },
  IMMEDIATE_DANGER: {
    bg: 'bg-red-900/90 border-red-500',
    icon: (
      <svg className="w-6 h-6 text-red-400 flex-shrink-0 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    text: 'text-red-100',
    label: 'DANGER',
  },
};

// Map all possible action names to display info
function getActionConfig(action) {
  switch (action) {
    case 'REROUTE':
      return { label: 'Take Alternate Route', color: 'bg-blue-600 hover:bg-blue-500', confirmLabel: 'Route Updated' };
    case 'EXIT_HIGHWAY':
    case 'PREPARE_TO_EXIT':
      return { label: 'Exit Highway Now', color: 'bg-orange-600 hover:bg-orange-500', confirmLabel: 'Exiting Highway' };
    case 'EXIT_TO_SHELTER':
    case 'SEEK_SHELTER':
      return { label: 'Exit to Safe Location', color: 'bg-orange-600 hover:bg-orange-500', confirmLabel: 'Navigating to Shelter' };
    case 'TAKE_COVER':
      return { label: 'TAKE COVER NOW', color: 'bg-red-600 hover:bg-red-500 animate-pulse', confirmLabel: 'Sheltering in Place' };
    case 'REDUCE_SPEED':
      return { label: 'Reduce Speed', color: 'bg-yellow-600 hover:bg-yellow-500', confirmLabel: 'Speed Reduced' };
    case 'USE_ALTERNATE_ROUTE':
      return { label: 'Use Alternate Route', color: 'bg-blue-600 hover:bg-blue-500', confirmLabel: 'Route Updated' };
    case 'PULL_OVER':
      return { label: 'Pull Over Safely', color: 'bg-red-600 hover:bg-red-500', confirmLabel: 'Pulling Over' };
    case 'EMERGENCY_SHELTER_IN_VEHICLE':
      return { label: 'Shelter in Vehicle', color: 'bg-red-600 hover:bg-red-500 animate-pulse', confirmLabel: 'Sheltering in Vehicle' };
    case 'CONTINUE_MONITORING':
      return { label: 'Continue Monitoring', color: 'bg-green-600 hover:bg-green-500', confirmLabel: 'Monitoring' };
    default:
      return null;
  }
}

export default function AlertBanner({ tier, message, action, countdown, shelters, alternateRoute, onAction }) {
  const [confirmedAction, setConfirmedAction] = useState(null);

  // Reset confirmed state when tier changes
  useEffect(() => {
    setConfirmedAction(null);
  }, [tier]);

  if (!tier || !message) return null;
  const style = tierStyles[tier] || tierStyles.MONITORING;
  const actionConfig = action ? getActionConfig(action) : null;
  const isConfirmed = confirmedAction === action;

  const bestShelter = shelters?.find(s => s.hasIndoorShelter) || shelters?.[0];

  const handleClick = () => {
    setConfirmedAction(action);
    onAction?.(action);
  };

  return (
    <div className={`rounded-xl border-2 backdrop-blur-sm shadow-2xl ${style.bg}`}>
      {/* Tier label bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10">
        {style.icon}
        <span className={`text-xs font-bold tracking-wider ${style.text}`}>{style.label}</span>
        {countdown != null && countdown > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-800/80 border border-red-600 text-red-200 text-xs font-bold tabular-nums">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {countdown} min {countdown <= 5 ? '- IMMINENT' : ''}
          </span>
        )}
      </div>

      {/* Message body */}
      <div className="px-4 py-3">
        <p className="text-sm text-white/90 leading-relaxed">{message}</p>

        {/* Shelter card — shown when shelter-related actions are active */}
        {bestShelter && (action === 'EXIT_HIGHWAY' || action === 'EXIT_TO_SHELTER' || action === 'SEEK_SHELTER' || action === 'PREPARE_TO_EXIT') && (
          <div className="mt-3 bg-green-900/40 border border-green-700/50 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" />
              </svg>
              <div>
                <span className="text-green-300 text-sm font-bold">{bestShelter.name}</span>
                <span className="text-green-400/70 text-xs ml-2">
                  {bestShelter.distanceMiles != null ? `${bestShelter.distanceMiles} mi` : ''}
                  {bestShelter.exitNumber ? ` · Exit ${bestShelter.exitNumber}` : ''}
                </span>
              </div>
            </div>
            {bestShelter.hasIndoorShelter && (
              <span className="inline-block mt-1 ml-6 text-xs text-green-400 bg-green-800/50 px-2 py-0.5 rounded">Indoor shelter available</span>
            )}
          </div>
        )}

        {/* Alternate route card */}
        {alternateRoute && (action === 'REROUTE' || action === 'USE_ALTERNATE_ROUTE') && (
          <div className="mt-3 bg-blue-900/40 border border-blue-700/50 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0020 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <span className="text-blue-300 text-sm font-bold">Alternate Route</span>
              <span className="text-blue-400/70 text-xs">
                {alternateRoute.distanceMiles ? `${alternateRoute.distanceMiles} mi` : ''}
                {alternateRoute.timeMinutes ? ` · ~${alternateRoute.timeMinutes} min` : ''}
              </span>
            </div>
            {alternateRoute.safetyScore && (
              <span className="inline-block mt-1 ml-6 text-xs text-blue-400 bg-blue-800/50 px-2 py-0.5 rounded">
                Safety score: {Math.round(alternateRoute.safetyScore * 100)}%
              </span>
            )}
          </div>
        )}

        {/* Action button */}
        {actionConfig && (
          <div className="mt-3">
            {isConfirmed ? (
              <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-700/60 border border-green-600 text-green-200 text-sm font-bold">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {actionConfig.confirmLabel}
              </div>
            ) : (
              <button
                onClick={handleClick}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold text-white transition-all active:scale-95 shadow-lg ${actionConfig.color}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                {actionConfig.label}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
