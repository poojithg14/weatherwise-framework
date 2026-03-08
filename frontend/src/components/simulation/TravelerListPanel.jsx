import { TIER_COLORS } from '../../hooks/useSimulationEngine';

const STATUS_BADGES = {
  loading:   { label: 'Loading', bg: 'bg-gray-600' },
  running:   { label: 'Running', bg: 'bg-green-600' },
  paused:    { label: 'Paused',  bg: 'bg-yellow-600' },
  completed: { label: 'Done',    bg: 'bg-blue-600' },
};

const SOURCE_BADGES = {
  auto:    { label: 'AUTO', bg: 'bg-green-700/50 text-green-300' },
  weather: { label: 'WX',   bg: 'bg-orange-700/50 text-orange-300' },
  manual:  { label: 'MAN',  bg: 'bg-blue-700/50 text-blue-300' },
};

function formatElapsed(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function TravelerListPanel({ travelers, completedCount, onPause, onResume, onRemove, onFocus }) {
  // Sort by risk score descending (highest risk on top)
  const sorted = [...travelers].sort((a, b) => {
    const aScore = a.riskData?.riskScore ?? -1;
    const bScore = b.riskData?.riskScore ?? -1;
    return bScore - aScore;
  });

  if (travelers.length === 0) {
    return (
      <div className="absolute top-16 right-3 z-[600] w-72 bg-ww-surface/95 backdrop-blur-sm border border-ww-border rounded-xl p-4">
        <p className="text-gray-400 text-sm text-center">
          Starting simulation...
        </p>
      </div>
    );
  }

  return (
    <div className="absolute top-16 right-3 z-[600] w-72 bg-ww-surface/95 backdrop-blur-sm border border-ww-border rounded-xl shadow-2xl shadow-black/30 max-h-[calc(100vh-5rem)] overflow-y-auto">
      <div className="px-4 py-3 border-b border-ww-border flex items-center justify-between">
        <h3 className="text-white font-semibold text-sm">
          Travelers ({travelers.filter(t => t.status === 'running').length} active)
        </h3>
        {completedCount > 0 && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-600/30 text-blue-400">
            {completedCount} completed
          </span>
        )}
      </div>

      <div className="divide-y divide-ww-border">
        {sorted.map(t => {
          const badge = STATUS_BADGES[t.status] || STATUS_BADGES.loading;
          const sourceBadge = SOURCE_BADGES[t.source] || SOURCE_BADGES.manual;
          const tier = t.riskData?.tier || 'MONITORING';
          const tierColor = TIER_COLORS[tier] || TIER_COLORS.MONITORING;
          const score = t.riskData?.riskScore;
          const alert = t.riskData?.alertMessage;

          return (
            <div key={t.id} className="px-4 py-3 hover:bg-ww-dark/50 transition-colors">
              {/* Name + status row */}
              <div className="flex items-center justify-between mb-1">
                <button
                  onClick={() => onFocus(t)}
                  className="text-white text-sm font-medium truncate max-w-[120px] hover:text-blue-400 transition-colors text-left"
                  title={`Focus on ${t.name}`}
                >
                  {t.name}
                </button>
                <div className="flex items-center gap-1">
                  <span className={`${sourceBadge.bg} text-[9px] font-bold px-1 py-0.5 rounded`}>
                    {sourceBadge.label}
                  </span>
                  <span className={`${badge.bg} text-white text-[10px] font-bold px-1.5 py-0.5 rounded`}>
                    {badge.label}
                  </span>
                </div>
              </div>

              {/* Risk info */}
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: tierColor }}
                  title={tier}
                />
                {score != null ? (
                  <span className="text-xs text-gray-300">
                    Risk: {(score * 100).toFixed(0)}%
                  </span>
                ) : (
                  <span className="text-xs text-gray-500">Awaiting data...</span>
                )}
                <span className="text-xs text-gray-500 ml-auto">{formatElapsed(t.elapsed)}</span>
              </div>

              {/* Alert message (truncated) */}
              {alert && (
                <p className="text-[11px] text-gray-400 truncate mb-2" title={alert}>
                  {alert}
                </p>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-1.5">
                {t.status === 'running' && (
                  <button
                    onClick={() => onPause(t.id)}
                    className="text-[11px] px-2 py-1 rounded bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30 transition-colors"
                  >
                    Pause
                  </button>
                )}
                {t.status === 'paused' && (
                  <button
                    onClick={() => onResume(t.id)}
                    className="text-[11px] px-2 py-1 rounded bg-green-600/20 text-green-400 hover:bg-green-600/30 transition-colors"
                  >
                    Resume
                  </button>
                )}
                <button
                  onClick={() => onFocus(t)}
                  className="text-[11px] px-2 py-1 rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-colors"
                >
                  Focus
                </button>
                <button
                  onClick={() => onRemove(t.id)}
                  className="text-[11px] px-2 py-1 rounded bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors ml-auto"
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
