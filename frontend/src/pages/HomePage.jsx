import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LocationInput from '../components/LocationInput';
import DemoModeToggle from '../components/DemoModeToggle';
import ScenarioSelector from '../components/ScenarioSelector';
import { fetchRoutes } from '../utils/routing';

export default function HomePage() {
  const navigate = useNavigate();
  const [isDemo, setIsDemo] = useState(true);
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [loading, setLoading] = useState(false);

  // Route selection state (real mode)
  const [routes, setRoutes] = useState([]);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);
  const [routesLoading, setRoutesLoading] = useState(false);

  const canStart = isDemo
    ? !!selectedScenario
    : (origin && destination && routes.length > 0);

  const handleFindRoutes = async () => {
    if (!origin || !destination) return;
    setRoutesLoading(true);
    setRoutes([]);
    setSelectedRouteIdx(0);
    try {
      const found = await fetchRoutes(origin, destination);
      setRoutes(found);
    } catch {
      setRoutes([]);
    }
    setRoutesLoading(false);
  };

  const handleStart = async () => {
    if (!canStart) return;
    setLoading(true);

    if (isDemo) {
      const mod = await selectedScenario.module();
      const scenario = mod.default;
      navigate('/trip', {
        state: { mode: 'demo', scenario },
      });
    } else {
      const selectedRoute = routes[selectedRouteIdx];
      navigate('/trip', {
        state: {
          mode: 'real',
          origin,
          destination,
          preloadedRoute: selectedRoute,
        },
      });
    }
  };

  return (
    <div className="min-h-screen bg-ww-dark flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg my-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">WeatherWise</h1>
          <p className="text-gray-400 text-sm">
            AI-Enhanced Severe Weather Alerting & Dynamic Rerouting
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-ww-surface border border-ww-border rounded-2xl p-6 space-y-6">
          {/* Mode Toggle */}
          <div className="flex justify-center">
            <DemoModeToggle isDemo={isDemo} onToggle={() => { setIsDemo(!isDemo); setRoutes([]); }} />
          </div>

          {isDemo ? (
            <ScenarioSelector selected={selectedScenario} onSelect={setSelectedScenario} />
          ) : (
            <div className="space-y-4">
              <LocationInput
                label="Starting Location"
                value={origin}
                onChange={(loc) => { setOrigin(loc); setRoutes([]); }}
                placeholder="e.g., Lexington, KY"
              />
              <LocationInput
                label="Destination"
                value={destination}
                onChange={(loc) => { setDestination(loc); setRoutes([]); }}
                placeholder="e.g., London, KY"
              />

              {/* Find Routes Button */}
              <button
                onClick={handleFindRoutes}
                disabled={!origin || !destination || routesLoading}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                  origin && destination
                    ? 'bg-gray-700 hover:bg-gray-600 text-white active:scale-[0.98]'
                    : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                }`}
              >
                {routesLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Finding Routes...
                  </span>
                ) : (
                  'Find Routes'
                )}
              </button>

              {/* Route Options */}
              {routes.length > 0 && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    {routes.length} route{routes.length > 1 ? 's' : ''} found — select one:
                  </label>
                  <div className="space-y-2">
                    {routes.map((r, idx) => (
                      <div
                        key={r.id}
                        onClick={() => setSelectedRouteIdx(idx)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && setSelectedRouteIdx(idx)}
                        className={`flex items-center justify-between px-4 py-3 rounded-lg border cursor-pointer transition-all ${
                          selectedRouteIdx === idx
                            ? 'border-blue-500 bg-blue-500/10 text-white'
                            : 'border-ww-border bg-ww-dark text-gray-300 hover:border-gray-500'
                        }`}
                        style={{ minHeight: 'unset' }}
                      >
                        <div>
                          <div className="font-medium text-sm">{r.label}</div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {r.distanceMiles} mi &middot; ~{r.durationMinutes} min
                          </div>
                        </div>
                        {selectedRouteIdx === idx && (
                          <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Start Button */}
          <button
            onClick={handleStart}
            disabled={!canStart || loading}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
              canStart
                ? 'bg-blue-600 hover:bg-blue-700 text-white active:scale-[0.98]'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Starting Trip...
              </span>
            ) : (
              'Start Trip'
            )}
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-600 mt-6">
          WeatherWise Framework
        </p>
      </div>
    </div>
  );
}
