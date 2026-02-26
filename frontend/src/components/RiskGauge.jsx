const tierConfig = {
  MONITORING: { color: '#2E7D32', label: 'Monitoring', bg: 'bg-ww-green/20' },
  ADVISORY: { color: '#F9A825', label: 'Advisory', bg: 'bg-ww-advisory/20' },
  ACTION_REQUIRED: { color: '#E65100', label: 'Action Required', bg: 'bg-ww-action/20' },
  IMMEDIATE_DANGER: { color: '#D32F2F', label: 'Immediate Danger', bg: 'bg-ww-danger/20' },
};

export default function RiskGauge({ score = 0, tier = 'MONITORING' }) {
  const config = tierConfig[tier] || tierConfig.MONITORING;
  const percent = Math.round(score * 100);
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - score);

  return (
    <div className={`rounded-xl p-4 ${config.bg} border border-ww-border transition-risk`}>
      <div className="flex items-center gap-4">
        <div className="relative w-28 h-28 flex-shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            <circle
              cx="60" cy="60" r={radius}
              fill="none" stroke="#30363d" strokeWidth="8"
            />
            <circle
              cx="60" cy="60" r={radius}
              fill="none" stroke={config.color} strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold" style={{ color: config.color }}>{percent}</span>
            <span className="text-xs text-gray-400">Risk</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div
            className="text-lg font-bold mb-1"
            style={{ color: config.color }}
          >
            {config.label}
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${percent}%`, backgroundColor: config.color }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
