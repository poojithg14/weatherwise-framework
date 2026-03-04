export default function InfoPanel({ data, elapsedMinutes }) {
  if (!data) return null;

  return (
    <div className="space-y-3">
      {/* Time elapsed */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">Elapsed Time</span>
        <span className="text-white font-mono">{elapsedMinutes} min</span>
      </div>

      {/* Hazards */}
      {data.stormCells && data.stormCells.length > 0 && (
        <div className="bg-ww-dark rounded-lg p-3 border border-ww-border">
          <h4 className="text-xs text-gray-400 uppercase tracking-wide mb-2">Active Hazards</h4>
          {data.stormCells.map((cell, i) => {
            const label = cell.type || cell.hazardType?.replace(/_/g, ' ') || 'Storm Cell';
            const severity = cell.severity || (cell.hazardType === 'TORNADO' ? 'EXTREME' : 'MODERATE');
            const sevColor = severity === 'EXTREME' ? 'text-red-400' :
                             severity === 'SEVERE' ? 'text-orange-400' :
                             'text-yellow-400';
            return (
              <div key={cell.id || i} className="flex items-center justify-between text-sm py-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${severity === 'EXTREME' ? 'bg-red-500 animate-pulse' : 'bg-orange-500'}`} />
                  <span className="text-gray-300 truncate">{label}</span>
                </div>
                <span className={`text-xs font-bold ${sevColor}`}>{severity}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Shelters */}
      {data.shelters && data.shelters.length > 0 && (
        <div className="bg-ww-dark rounded-lg p-3 border border-green-900/50">
          <h4 className="text-xs text-green-400 uppercase tracking-wide mb-2">
            <span className="inline-flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" />
              </svg>
              Nearby Shelters
            </span>
          </h4>
          {data.shelters.map((s, i) => (
            <div key={i} className="py-1.5 border-b border-ww-border/50 last:border-0">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.hasIndoorShelter ? 'bg-green-500' : 'bg-green-800'}`} />
                  <span className="text-gray-200 truncate font-medium">{s.name}</span>
                </div>
                <span className="text-gray-400 text-xs flex-shrink-0 ml-2 font-mono">
                  {typeof s.distanceMiles === 'number' ? s.distanceMiles.toFixed(1) : s.distanceMiles} mi
                </span>
              </div>
              <div className="flex items-center gap-2 ml-4 mt-0.5">
                {s.exitNumber && (
                  <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">Exit {s.exitNumber}</span>
                )}
                {s.hasIndoorShelter && (
                  <span className="text-xs text-green-400 bg-green-900/30 px-1.5 py-0.5 rounded">Indoor Shelter</span>
                )}
                {s.type && (
                  <span className="text-xs text-gray-500">{s.type.replace(/_/g, ' ')}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Alternate Route */}
      {data.alternateRoute && (
        <div className="bg-blue-900/20 rounded-lg p-3 border border-blue-800">
          <h4 className="text-xs text-blue-400 uppercase tracking-wide mb-2">
            <span className="inline-flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              Alternate Route Available
            </span>
          </h4>
          {data.alternateRoute.description && (
            <p className="text-sm text-gray-300 mb-1">{data.alternateRoute.description}</p>
          )}
          <div className="flex items-center gap-3 text-xs text-gray-400">
            {data.alternateRoute.distanceMiles && (
              <span className="font-mono">{data.alternateRoute.distanceMiles} mi</span>
            )}
            {data.alternateRoute.timeMinutes && (
              <span className="font-mono">~{data.alternateRoute.timeMinutes} min</span>
            )}
            {data.alternateRoute.safetyScore && (
              <span className="text-green-400 font-bold">
                Safety: {Math.round(data.alternateRoute.safetyScore * 100)}%
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
