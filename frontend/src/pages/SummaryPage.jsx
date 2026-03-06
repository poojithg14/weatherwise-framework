import { useLocation, useNavigate } from 'react-router-dom';

const tierColor = {
  MONITORING: '#22c55e',
  ADVISORY: '#eab308',
  ACTION_REQUIRED: '#f97316',
  IMMEDIATE_DANGER: '#ef4444',
};

const tierLabel = {
  MONITORING: 'Monitoring',
  ADVISORY: 'Advisory',
  ACTION_REQUIRED: 'Action Required',
  IMMEDIATE_DANGER: 'Immediate Danger',
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
  const { summary } = location.state || {};

  if (!summary) {
    return (
      <div className="min-h-screen bg-ww-dark pt-14 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-ww-surface border border-ww-border flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-gray-400">No trip data available.</p>
          <button
            onClick={() => navigate('/')}
            className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white px-6 py-3 rounded-xl font-bold transition-all active:scale-[0.98] shadow-lg shadow-blue-500/20"
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

  // SVG circular progress
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (maxPercent / 100) * circumference;

  const stats = [
    {
      label: 'Distance',
      value: `${(summary.totalDistanceMiles || 0).toFixed(1)}`,
      unit: 'mi',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
    {
      label: 'Duration',
      value: `${summary.totalTimeMinutes || 0}`,
      unit: 'min',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Alerts',
      value: `${summary.alertsReceived || 0}`,
      unit: '',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ),
    },
    {
      label: 'Actions',
      value: `${summary.actionsRecommended || 0}`,
      unit: '',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="h-screen overflow-hidden bg-ww-dark pt-14 flex items-center justify-center">
      <div className="max-w-md mx-auto px-4 py-8 w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-1.5 mb-4">
            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm text-green-300">Trip Complete</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Trip Summary</h1>
        </div>

        {/* Risk Score Ring */}
        <div className="bg-ww-surface border border-ww-border rounded-2xl p-8 mb-6 shadow-2xl shadow-black/20">
          <div className="flex flex-col items-center">
            <p className="text-gray-400 text-sm mb-4">Peak Risk Score</p>
            <div className="relative w-36 h-36 mb-4">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r={radius} fill="none" stroke="#1e293b" strokeWidth="8" />
                <circle
                  cx="60" cy="60" r={radius} fill="none"
                  stroke={maxColor} strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold text-white">{maxPercent}</span>
                <span className="text-xs text-gray-400">/ 100</span>
              </div>
            </div>
            <div
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold"
              style={{ backgroundColor: `${maxColor}20`, color: maxColor }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: maxColor }} />
              {tierLabel[maxTier]}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-ww-surface border border-ww-border rounded-xl p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="text-gray-500">{stat.icon}</div>
                <span className="text-gray-400 text-xs">{stat.label}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-white">{stat.value}</span>
                {stat.unit && <span className="text-sm text-gray-500">{stat.unit}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Action Button */}
        <button
          onClick={() => navigate('/')}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-bold py-4 rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-blue-500/20"
        >
          Start New Trip
        </button>

        {/* Footer */}
        <p className="text-center text-xs text-gray-600 mt-4">
          WeatherWise Framework
        </p>
      </div>
    </div>
  );
}
