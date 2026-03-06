import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LocationInput from '../components/LocationInput';
import { fetchRoutes } from '../utils/routing';

export default function HomePage() {
  const navigate = useNavigate();
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [routes, setRoutes] = useState([]);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);
  const [routesLoading, setRoutesLoading] = useState(false);

  const canStart = origin && destination && routes.length > 0;

  const handleFindRoutes = async () => {
    if (!origin || !destination) return;
    setRoutesLoading(true);
    setRoutes([]);
    setSelectedRouteIdx(0);
    setError(null);
    try {
      const found = await fetchRoutes(origin, destination);
      if (found.length === 0) setError('No routes found. Try different locations.');
      setRoutes(found);
    } catch {
      setError('Could not fetch routes. Check your connection.');
      setRoutes([]);
    }
    setRoutesLoading(false);
  };

  const handleStart = () => {
    if (!canStart) return;
    setLoading(true);
    navigate('/trip', {
      state: { origin, destination, preloadedRoute: routes[selectedRouteIdx] },
    });
  };

  return (
    <div className="h-screen overflow-hidden bg-ww-dark pt-14 flex items-center justify-center">
      <div className="w-full max-w-md px-4 py-4">
        {/* Title */}
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-white">Start a Trip</h1>
        </div>

        {/* Main Card */}
        <div className="bg-ww-surface border border-ww-border rounded-2xl p-4 space-y-4 shadow-2xl shadow-black/20">
          <div className="space-y-3">
            <LocationInput label="Starting Location" value={origin} onChange={(loc) => { setOrigin(loc); setRoutes([]); setError(null); }} placeholder="e.g., Lexington, KY" />
            <LocationInput label="Destination" value={destination} onChange={(loc) => { setDestination(loc); setRoutes([]); setError(null); }} placeholder="e.g., London, KY" />

            <button onClick={handleFindRoutes} disabled={!origin || !destination || routesLoading}
              className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-all ${origin && destination ? 'bg-ww-border hover:bg-gray-600 text-white active:scale-[0.98]' : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`}>
              {routesLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Finding Routes...
                </span>
              ) : 'Find Routes'}
            </button>

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            {routes.length > 0 && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">{routes.length} route{routes.length > 1 ? 's' : ''} found:</label>
                <div className="space-y-2">
                  {routes.map((r, idx) => (
                    <div key={r.id} onClick={() => setSelectedRouteIdx(idx)} role="button" tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && setSelectedRouteIdx(idx)}
                      className={`flex items-center justify-between px-4 py-3 rounded-lg border cursor-pointer transition-all ${selectedRouteIdx === idx ? 'border-blue-500 bg-blue-500/10 text-white' : 'border-ww-border bg-ww-dark text-gray-300 hover:border-gray-500'}`}
                      style={{ minHeight: 'unset' }}>
                      <div>
                        <div className="font-medium text-sm">{r.label}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{r.distanceMiles} mi &middot; ~{r.durationMinutes} min</div>
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

          <button onClick={handleStart} disabled={!canStart || loading}
            className={`w-full py-3.5 rounded-xl font-bold text-base transition-all ${canStart ? 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white active:scale-[0.98] shadow-lg shadow-blue-500/20' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Starting Trip...
              </span>
            ) : 'Start Trip'}
          </button>
        </div>
      </div>
    </div>
  );
}
