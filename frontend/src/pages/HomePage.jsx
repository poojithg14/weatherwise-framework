import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LocationInput from '../components/LocationInput';
import { fetchRoutes } from '../utils/routing';

/* ── Demo route presets ── */
const DEMO_ROUTES = {
  louisville: {
    origin: { lat: 38.2527, lon: -85.7585, label: 'Louisville, KY' },
    destination: { lat: 37.1290, lon: -84.0833, label: 'London, KY' },
  },
};

/* ── Health Dot ── */
function HealthDot() {
  const [status, setStatus] = useState('unknown');

  useEffect(() => {
    let mounted = true;
    const check = () => {
      fetch('/actuator/health')
        .then((r) => { if (mounted) setStatus(r.ok ? 'up' : 'down'); })
        .catch(() => { if (mounted) setStatus('down'); });
    };
    check();
    const id = setInterval(check, 30000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  if (status === 'unknown') return null;
  const isUp = status === 'up';
  return (
    <div className="flex items-center gap-1.5" title={isUp ? 'Backend connected' : 'Backend offline'}>
      <div className={`w-2 h-2 rounded-full ${isUp ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
      <span className="text-gray-500 text-xs">{isUp ? 'Live' : 'Offline'}</span>
    </div>
  );
}

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

  const handleTryDemo = () => {
    const demo = DEMO_ROUTES.louisville;
    setOrigin(demo.origin);
    setDestination(demo.destination);
    setRoutes([]);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-ww-dark pt-14 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* ── Hero Section ── */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight mb-3">
            AI-Powered Severe Weather Protection
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
              for Highway Travelers
            </span>
          </h1>
          <p className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            Adapts MIT Lincoln Lab&apos;s Corridor Weather Avoidance Model (CWAM) from aviation
            to highway vehicles — delivering real-time multi-hazard alerting and dynamic rerouting.
          </p>
        </div>

        {/* ── Stat Badges (research-backed) ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { value: '99.57%', label: 'ML Accuracy', color: 'from-green-500/20 to-emerald-500/20', border: 'border-green-500/30' },
            { value: '1.97ms', label: 'Mean Latency', color: 'from-blue-500/20 to-cyan-500/20', border: 'border-blue-500/30' },
            { value: '24.8 min', label: 'Lead Time Adv.', color: 'from-purple-500/20 to-violet-500/20', border: 'border-purple-500/30' },
            { value: '6', label: 'Hazard Types', color: 'from-red-500/20 to-orange-500/20', border: 'border-red-500/30' },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`bg-gradient-to-br ${stat.color} border ${stat.border} rounded-xl px-4 py-3 text-center`}
            >
              <div className="text-white font-bold text-lg">{stat.value}</div>
              <div className="text-gray-400 text-xs font-medium">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* ── National Impact Banner ── */}
        <div className="flex items-center justify-between bg-ww-surface border border-ww-border rounded-xl px-4 py-3 mb-8">
          <p className="text-gray-400 text-xs leading-relaxed">
            Reducing weather-related highway fatalities.{' '}
            <span className="text-gray-300 font-medium">~6,000 deaths</span> and{' '}
            <span className="text-gray-300 font-medium">~1.2M crashes</span> annually.
          </p>
          <HealthDot />
        </div>

        {/* ── Feature Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {/* Real-Time NWS Integration */}
          <div className="bg-ww-surface border border-ww-border rounded-xl p-4">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
              </svg>
            </div>
            <h3 className="text-white font-semibold text-sm mb-1">Real-Time NWS Integration</h3>
            <p className="text-gray-400 text-xs leading-relaxed">
              Live polling of National Weather Service alerts — tornadoes, thunderstorms, floods, winter storms, and more.
            </p>
          </div>

          {/* ML Risk Scoring */}
          <div className="bg-ww-surface border border-ww-border rounded-xl p-4">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-white font-semibold text-sm mb-1">ML Risk Scoring</h3>
            <p className="text-gray-400 text-xs leading-relaxed">
              Gradient-boosted model scores intersection risk in real time, producing a 4-tier alert classification.
            </p>
          </div>

          {/* Dynamic Rerouting */}
          <div className="bg-ww-surface border border-ww-border rounded-xl p-4">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <h3 className="text-white font-semibold text-sm mb-1">Dynamic Rerouting</h3>
            <p className="text-gray-400 text-xs leading-relaxed">
              Automatically suggests safer alternative routes when hazards intersect the traveler&apos;s path.
            </p>
          </div>
        </div>

        {/* ── Trip Planner Card ── */}
        <div className="max-w-md mx-auto">
          <div className="bg-ww-surface border border-ww-border rounded-2xl p-4 space-y-4 shadow-2xl shadow-black/20">
            <h2 className="text-white font-semibold text-base text-center">Plan a Trip</h2>
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

          {/* ── Quick Actions ── */}
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <button
              onClick={handleTryDemo}
              className="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-amber-600/80 to-orange-600/80 hover:from-amber-600 hover:to-orange-600 text-white transition-all active:scale-[0.98]"
            >
              Try Demo: Louisville Tornado Corridor
            </button>
            <button
              onClick={() => navigate('/research')}
              className="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-purple-600/80 to-violet-600/80 hover:from-purple-600 hover:to-violet-600 text-white transition-all active:scale-[0.98]"
            >
              Research &amp; Technology
            </button>
            <button
              onClick={() => navigate('/simulate')}
              className="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-emerald-600/80 to-teal-600/80 hover:from-emerald-600 hover:to-teal-600 text-white transition-all active:scale-[0.98]"
            >
              Open Simulation Dashboard
            </button>
          </div>

          {/* ── Reference ── */}
          <p className="text-center text-gray-500 text-[11px] mt-6 leading-relaxed">
            Published in <span className="text-gray-400">the journal</span> &mdash;
            &ldquo;WeatherWise: AI-Enhanced Framework for Real-Time Multi-Hazard
            Severe Weather Alerting and Dynamic Rerouting for Highway Travelers&rdquo;
          </p>
        </div>
      </div>
    </div>
  );
}
