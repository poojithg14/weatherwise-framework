import React from 'react';

function ShelterIcon({ type }) {
  const iconColor = '#2E7D32';
  switch (type) {
    case 'GAS_STATION':
      return (
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <rect x="4" y="6" width="14" height="16" rx="2" stroke={iconColor} strokeWidth="2" />
          <path d="M18 12h2a2 2 0 012 2v4a1 1 0 01-1 1h0a1 1 0 01-1-1v-2" stroke={iconColor} strokeWidth="2" />
          <rect x="8" y="10" width="6" height="5" rx="1" stroke={iconColor} strokeWidth="1.5" />
        </svg>
      );
    case 'REST_AREA':
      return (
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <path d="M4 22h20M6 22V10l8-4 8 4v12" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="11" y="15" width="6" height="7" stroke={iconColor} strokeWidth="1.5" />
          <path d="M14 6v2" stroke={iconColor} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'HOTEL':
      return (
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <rect x="4" y="8" width="20" height="14" rx="2" stroke={iconColor} strokeWidth="2" />
          <path d="M4 15h20" stroke={iconColor} strokeWidth="1.5" />
          <rect x="8" y="11" width="4" height="4" rx="2" fill={iconColor} opacity="0.4" />
          <path d="M8 22v-3M20 22v-3" stroke={iconColor} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <circle cx="14" cy="14" r="8" stroke={iconColor} strokeWidth="2" />
          <path d="M14 10v4l3 3" stroke={iconColor} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
  }
}

export default function ShelterPanel({ shelters = [], visible = false, onNavigate, onClose }) {
  if (!visible || shelters.length === 0) return null;

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-[1100] animate-slide-up"
      style={{
        maxHeight: '60vh',
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
            <path d="M10 1l-9 9h3v8h5v-5h2v5h5v-8h3L10 1z" fill="#E65100" />
          </svg>
          <h2 className="text-lg font-bold text-white">Nearest Shelters</h2>
        </div>
        <button
          onClick={onClose}
          className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-white/10 transition-colors"
          aria-label="Close shelter panel"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M5 5l10 10M15 5L5 15" stroke="#8b949e" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Shelter list */}
      <div className="overflow-y-auto" style={{ maxHeight: 'calc(60vh - 60px)' }}>
        {shelters.map((shelter) => (
          <div
            key={shelter.id}
            className="flex items-center gap-3 px-4 py-3 border-b border-ww-border/50 last:border-b-0"
          >
            {/* Type icon */}
            <div
              className="flex-shrink-0 flex items-center justify-center rounded-lg"
              style={{
                width: 48,
                height: 48,
                backgroundColor: 'rgba(46, 125, 50, 0.15)',
                border: '1px solid rgba(46, 125, 50, 0.3)',
              }}
            >
              <ShelterIcon type={shelter.type} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base truncate">{shelter.name}</h3>
                {shelter.hasIndoorShelter && (
                  <span
                    className="flex-shrink-0 px-2 py-0.5 rounded text-xs font-bold"
                    style={{
                      backgroundColor: 'rgba(46, 125, 50, 0.25)',
                      color: '#66BB6A',
                      border: '1px solid rgba(46, 125, 50, 0.4)',
                    }}
                  >
                    INDOOR SHELTER
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-400 mt-0.5">{shelter.exitInfo}</p>
              <div className="flex items-center gap-3 mt-1 text-sm">
                <span className="text-gray-300 font-medium">{shelter.distance} mi</span>
                <span className="text-gray-500">|</span>
                <span className="text-gray-300">{shelter.driveTime} min drive</span>
              </div>
            </div>

            {/* Navigate button */}
            <button
              onClick={() => onNavigate && onNavigate(shelter)}
              className="flex-shrink-0 flex items-center justify-center px-4 py-3 rounded-lg font-bold text-sm transition-colors active:scale-95"
              style={{
                backgroundColor: '#2E7D32',
                color: '#FFFFFF',
                minHeight: '48px',
                boxShadow: '0 2px 8px rgba(46, 125, 50, 0.3)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mr-1.5">
                <path d="M14 2L2 7l5 2 2 5 5-12z" fill="currentColor" />
              </svg>
              NAVIGATE
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
