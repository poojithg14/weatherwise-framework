import React, { useState, useEffect } from 'react';

function WarningIcon({ size = 24, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 2L1 21h22L12 2zm0 4l7.53 13H4.47L12 6z"
        fill={color}
      />
      <rect x="11" y="10" width="2" height="4" fill={color} />
      <rect x="11" y="16" width="2" height="2" fill={color} />
    </svg>
  );
}

function TornadoIcon({ size = 48, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 8h32M12 14h24M15 20h18M18 26h12M20 32h8M22 38h4" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function formatTimeToImpact(minutes) {
  if (minutes <= 0) return 'NOW';
  if (minutes < 1) return '< 1 MIN';
  if (minutes === 1) return '1 MIN';
  return `${minutes} MIN`;
}

function getActionButtonLabel(actionType) {
  switch (actionType) {
    case 'REROUTE':
      return 'VIEW REROUTE';
    case 'EXIT_TO_SHELTER':
      return 'FIND SHELTER';
    case 'PREPARE_TO_PULL_OVER':
      return 'PREPARE TO PULL OVER';
    default:
      return 'TAKE ACTION';
  }
}

export default function AlertBanner({
  tier,
  alertMessage,
  instruction,
  actionType,
  timeToImpact,
  onActionClick,
  onDismiss,
}) {
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed state when tier changes
  useEffect(() => {
    setDismissed(false);
  }, [tier]);

  if (!tier || tier === 'NONE') return null;

  // ADVISORY: Small yellow bar, dismissible
  if (tier === 'ADVISORY') {
    if (dismissed) return null;

    return (
      <div
        className="absolute top-0 left-0 right-0 z-[1000] flex items-center justify-between px-4 animate-fade-in"
        style={{
          height: '44px',
          backgroundColor: 'rgba(249, 168, 37, 0.95)',
          color: '#000000',
          borderBottom: '2px solid #F57F17',
        }}
        role="alert"
        aria-live="polite"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <WarningIcon size={20} color="#000000" />
          <span className="font-semibold text-sm truncate">{alertMessage}</span>
        </div>
        <button
          onClick={() => {
            setDismissed(true);
            onDismiss && onDismiss();
          }}
          className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-black/20 transition-colors flex-shrink-0"
          style={{ minHeight: '32px', minWidth: '32px' }}
          aria-label="Dismiss alert"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 4l8 8M12 4l-8 8" stroke="#000" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    );
  }

  // ACTION_REQUIRED: Large orange banner, NOT dismissible
  if (tier === 'ACTION_REQUIRED') {
    return (
      <div
        className="absolute top-0 left-0 right-0 z-[1000] flex flex-col justify-center px-4 py-3 animate-fade-in"
        style={{
          minHeight: '120px',
          backgroundColor: 'rgba(230, 81, 0, 0.97)',
          color: '#FFFFFF',
          borderBottom: '3px solid #BF360C',
          boxShadow: '0 4px 20px rgba(230, 81, 0, 0.5)',
        }}
        role="alert"
        aria-live="assertive"
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1">
            <WarningIcon size={32} color="#FFFFFF" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-lg tracking-wide">SEVERE WEATHER ALERT</span>
              <span
                className="flex-shrink-0 px-2 py-0.5 rounded text-sm font-bold"
                style={{
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  color: '#FFFFFF',
                }}
              >
                {formatTimeToImpact(timeToImpact)}
              </span>
            </div>
            <p className="text-base font-medium leading-snug opacity-95">
              {alertMessage}
            </p>
          </div>
        </div>

        <button
          onClick={onActionClick}
          className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-lg tracking-wide transition-colors active:scale-95"
          style={{
            backgroundColor: '#FFFFFF',
            color: '#BF360C',
            minHeight: '52px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          {getActionButtonLabel(actionType)}
        </button>
      </div>
    );
  }

  // IMMEDIATE_DANGER: Full screen red overlay
  if (tier === 'IMMEDIATE_DANGER') {
    return (
      <div
        className="absolute inset-0 z-[2000] flex flex-col items-center justify-center p-6 danger-overlay"
        style={{
          backgroundColor: 'rgba(183, 28, 28, 0.97)',
          border: '8px solid #D32F2F',
        }}
        role="alert"
        aria-live="assertive"
      >
        <div className="flex flex-col items-center text-center max-w-lg">
          <TornadoIcon size={64} color="#FFFFFF" />

          <h1
            className="mt-4 font-black tracking-widest"
            style={{
              fontSize: 'clamp(28px, 8vw, 48px)',
              color: '#FFFFFF',
              textShadow: '0 2px 8px rgba(0,0,0,0.5)',
              lineHeight: 1.1,
            }}
          >
            TORNADO DANGER
          </h1>

          <div
            className="mt-6 px-4 py-4 rounded-lg w-full"
            style={{
              backgroundColor: 'rgba(0,0,0,0.35)',
              border: '2px solid rgba(255,255,255,0.3)',
            }}
          >
            <p
              className="font-bold leading-relaxed"
              style={{
                fontSize: 'clamp(18px, 5vw, 28px)',
                color: '#FFFFFF',
              }}
            >
              {instruction}
            </p>
          </div>

          <div className="mt-6 flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full animate-pulse"
              style={{ backgroundColor: '#FF5252' }}
            />
            <span
              className="font-bold text-lg tracking-wide"
              style={{ color: '#FFCDD2' }}
            >
              {formatTimeToImpact(timeToImpact)} UNTIL IMPACT
            </span>
          </div>

          <p
            className="mt-8 text-sm opacity-70"
            style={{ color: '#FFCDD2' }}
          >
            Do NOT stay in your vehicle under an overpass.
            Get below road level if possible.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
