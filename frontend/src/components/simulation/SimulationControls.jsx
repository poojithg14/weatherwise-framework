import { TIER_COLORS } from '../../hooks/useSimulationEngine';

export default function SimulationControls({
  travelers, onPauseAll, onResumeAll, onEndAll,
  stats, autoMode,
}) {
  const running = travelers.filter(t => t.status === 'running').length;
  const paused = travelers.filter(t => t.status === 'paused').length;
  const total = travelers.length;
  const hasActive = running > 0 || paused > 0;

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[700] flex items-center gap-2">
      {/* SIM badge */}
      <div className="flex items-center gap-1.5 bg-purple-700/90 backdrop-blur-sm text-white font-bold text-xs px-3 py-2 rounded-lg shadow-lg">
        <span className="inline-block w-2 h-2 rounded-full bg-white animate-pulse" />
        SIM
      </div>

      {/* AUTO badge */}
      {autoMode && (
        <div className="flex items-center gap-1 bg-green-700/80 backdrop-blur-sm text-green-200 font-bold text-[11px] px-2.5 py-2 rounded-lg">
          AUTO
        </div>
      )}

      {/* NWS badge */}
      {stats?.nwsAlertCount > 0 && (
        <div className="flex items-center gap-1 bg-orange-700/80 backdrop-blur-sm text-orange-200 font-bold text-[11px] px-2.5 py-2 rounded-lg">
          NWS {stats.nwsAlertCount}
        </div>
      )}

      {/* Live stats */}
      <div className="bg-ww-surface/90 backdrop-blur-sm border border-ww-border rounded-lg px-3 py-2 flex items-center gap-3">
        <span className="text-xs text-gray-300">
          <span className="text-white font-mono font-bold">{running}</span>
          <span className="text-gray-500">/{total}</span>
          <span className="text-gray-500 ml-1">active</span>
        </span>

        {stats?.completedCount > 0 && (
          <span className="text-xs text-blue-400">
            {stats.completedCount} done
          </span>
        )}

        {stats?.weatherTripCount > 0 && (
          <span className="text-xs text-orange-400">
            {stats.weatherTripCount} wx
          </span>
        )}

        {paused > 0 && (
          <span className="text-xs text-yellow-400">{paused} paused</span>
        )}
      </div>

      {/* Risk stats */}
      {stats && stats.activeCount > 0 && stats.meanRisk > 0 && (
        <div className="bg-ww-surface/90 backdrop-blur-sm border border-ww-border rounded-lg px-3 py-2 flex items-center gap-2">
          <span className="text-xs text-gray-400">Risk:</span>
          <span className="text-xs text-gray-200 font-mono">
            avg {(stats.meanRisk * 100).toFixed(0)}%
          </span>
          <span className="text-xs text-red-400 font-mono">
            max {(stats.maxRisk * 100).toFixed(0)}%
          </span>

          {/* Tier dots */}
          <div className="flex items-center gap-0.5 ml-1">
            {Object.entries(stats.tiers).map(([tier, count]) => (
              count > 0 && (
                <span
                  key={tier}
                  className="flex items-center gap-0.5"
                  title={`${tier}: ${count}`}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: TIER_COLORS[tier] }}
                  />
                  <span className="text-[10px] text-gray-400">{count}</span>
                </span>
              )
            ))}
          </div>
        </div>
      )}

      {/* Control buttons */}
      {total > 0 && (
        <div className="flex items-center gap-1.5">
          {running > 0 && (
            <button
              onClick={onPauseAll}
              className="bg-yellow-600/80 hover:bg-yellow-600 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors backdrop-blur-sm"
              title="Pause all travelers"
            >
              Pause All
            </button>
          )}
          {paused > 0 && (
            <button
              onClick={onResumeAll}
              className="bg-green-600/80 hover:bg-green-600 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors backdrop-blur-sm"
              title="Resume all travelers"
            >
              Play All
            </button>
          )}
          {hasActive && (
            <button
              onClick={onEndAll}
              className="bg-red-600/80 hover:bg-red-600 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors backdrop-blur-sm"
              title="End all trips"
            >
              End All
            </button>
          )}
        </div>
      )}
    </div>
  );
}
