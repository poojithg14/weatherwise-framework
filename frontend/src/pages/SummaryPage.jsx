import { useLocation, useNavigate } from 'react-router-dom';

const tierColor = {
  MONITORING: '#2E7D32',
  ADVISORY: '#F9A825',
  ACTION_REQUIRED: '#E65100',
  IMMEDIATE_DANGER: '#D32F2F',
};

function getMaxTier(score) {
  if (score >= 0.8) return 'IMMEDIATE_DANGER';
  if (score >= 0.5) return 'ACTION_REQUIRED';
  if (score >= 0.2) return 'ADVISORY';
  return 'MONITORING';
}

export default function SummaryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { summary, mode } = location.state || {};

  if (!summary) {
    return (
      <div className="min-h-screen bg-ww-dark flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">No trip data available.</p>
          <button
            onClick={() => navigate('/')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold transition-colors"
          >
            Start New Trip
          </button>
        </div>
      </div>
    );
  }

  const maxTier = getMaxTier(summary.maxRiskScore || 0);
  const maxColor = tierColor[maxTier];
  const maxPercent = Math.round((summary.maxRiskScore || 0) * 100);

  const stats = [
    { label: 'Total Distance', value: `${(summary.totalDistanceMiles || 0).toFixed(1)} mi` },
    { label: 'Total Time', value: `${summary.totalTimeMinutes || 0} min` },
    { label: 'Alerts Received', value: summary.alertsReceived || 0 },
    { label: 'Actions Recommended', value: summary.actionsRecommended || 0 },
  ];

  return (
    <div className="min-h-screen bg-ww-dark flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">Trip Complete</h1>
          {summary.scenarioName && (
            <p className="text-gray-400 text-sm">{summary.scenarioName}</p>
          )}
        </div>

        {/* Max Risk Score Card */}
        <div
          className="rounded-2xl border-2 p-6 mb-6 text-center"
          style={{ borderColor: maxColor, backgroundColor: `${maxColor}15` }}
        >
          <p className="text-gray-400 text-sm mb-2">Peak Risk Score</p>
          <p className="text-5xl font-bold mb-2" style={{ color: maxColor }}>
            {maxPercent}
          </p>
          <p className="text-sm font-semibold" style={{ color: maxColor }}>
            {maxTier.replace(/_/g, ' ')}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-ww-surface border border-ww-border rounded-xl p-4 text-center"
            >
              <p className="text-gray-400 text-xs mb-1">{stat.label}</p>
              <p className="text-xl font-bold text-white">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Mode Badge */}
        <div className="text-center mb-6">
          <span className="inline-flex items-center gap-2 bg-ww-surface border border-ww-border rounded-lg px-3 py-2 text-xs text-gray-400">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: mode === 'demo' ? '#F9A825' : '#2E7D32' }}
            />
            {mode === 'demo' ? 'Demo Mode' : 'Real Mode'}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => navigate('/')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-colors active:scale-[0.98]"
          >
            Start New Trip
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
