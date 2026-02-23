import React from 'react';

function formatTime(minutes) {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins} min`;
  if (mins === 0) return `${hrs} hr`;
  return `${hrs} hr ${mins} min`;
}

function SafetyBar({ score }) {
  const clampedScore = Math.max(0, Math.min(100, score));
  let barColor = '#D32F2F';
  if (clampedScore >= 80) barColor = '#2E7D32';
  else if (clampedScore >= 50) barColor = '#F9A825';

  return (
    <div className="flex items-center gap-2 mt-1">
      <span className="text-xs text-gray-400 w-14">Safety</span>
      <div
        className="flex-1 h-2 rounded-full overflow-hidden"
        style={{ backgroundColor: '#30363d' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${clampedScore}%`,
            backgroundColor: barColor,
            boxShadow: `0 0 6px ${barColor}60`,
          }}
        />
      </div>
      <span
        className="text-xs font-bold w-8 text-right"
        style={{ color: barColor }}
      >
        {clampedScore}
      </span>
    </div>
  );
}

export default function RoutePanel({
  visible = false,
  currentRoute,
  alternateRoute,
  onAcceptReroute,
  onClose,
}) {
  if (!visible || !alternateRoute) return null;

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-[1100] animate-slide-up"
      style={{
        background: 'linear-gradient(180deg, #1a1f26 0%, #0d1117 100%)',
        borderTop: '2px solid #E65100',
        borderRadius: '16px 16px 0 0',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.6)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-ww-border">
        <div className="flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M3 10l4-4v3h6V6l4 4-4 4v-3H7v3L3 10z" fill="#E65100" />
          </svg>
          <h2 className="text-lg font-bold text-white">Route Options</h2>
        </div>
        <button
          onClick={onClose}
          className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-white/10 transition-colors"
          aria-label="Close route panel"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M5 5l10 10M15 5L5 15" stroke="#8b949e" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Current route - danger */}
        {currentRoute && (
          <div
            className="p-3 rounded-lg"
            style={{
              backgroundColor: 'rgba(211, 47, 47, 0.1)',
              border: '1px solid rgba(211, 47, 47, 0.4)',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: '#D32F2F' }}
                />
                <span className="font-bold text-white text-base">
                  {currentRoute.name}
                </span>
              </div>
              <span
                className="px-2 py-0.5 rounded text-xs font-bold"
                style={{
                  backgroundColor: 'rgba(211, 47, 47, 0.3)',
                  color: '#EF5350',
                }}
              >
                DANGER
              </span>
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-300">
              <span>{currentRoute.distance} mi</span>
              <span>{formatTime(currentRoute.estimatedTime)}</span>
            </div>
            <SafetyBar score={15} />
          </div>
        )}

        {/* Alternate route - safe */}
        <div
          className="p-3 rounded-lg"
          style={{
            backgroundColor: 'rgba(46, 125, 50, 0.1)',
            border: '2px solid rgba(46, 125, 50, 0.5)',
            boxShadow: '0 0 12px rgba(46, 125, 50, 0.15)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: '#2E7D32' }}
              />
              <span className="font-bold text-white text-base">
                {alternateRoute.name}
              </span>
            </div>
            <span
              className="px-2 py-0.5 rounded text-xs font-bold"
              style={{
                backgroundColor: 'rgba(46, 125, 50, 0.3)',
                color: '#66BB6A',
              }}
            >
              RECOMMENDED
            </span>
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-300">
            <span>{alternateRoute.distance} mi</span>
            <span>{formatTime(alternateRoute.estimatedTime)}</span>
            <span className="text-yellow-400 font-medium">
              +{alternateRoute.addedTime} min
            </span>
          </div>
          <SafetyBar score={alternateRoute.safetyScore} />
        </div>

        {/* Accept reroute button */}
        <button
          onClick={onAcceptReroute}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-lg font-bold text-xl tracking-wide transition-colors active:scale-95"
          style={{
            backgroundColor: '#2E7D32',
            color: '#FFFFFF',
            minHeight: '56px',
            boxShadow: '0 4px 16px rgba(46, 125, 50, 0.4)',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" fill="currentColor" />
          </svg>
          ACCEPT REROUTE
        </button>
      </div>
    </div>
  );
}
