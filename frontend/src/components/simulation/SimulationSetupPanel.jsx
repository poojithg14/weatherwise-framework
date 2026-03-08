import { useState } from 'react';
import LocationInput from '../LocationInput';
import CORRIDORS from '../../simulation/corridors';

export default function SimulationSetupPanel({
  onAddTraveler, travelerCount, collapsed, onToggle,
  autoMode, onToggleAuto, onScanNws, nwsAlertCount, activeTravelers,
}) {
  const [mode, setMode] = useState('corridor'); // 'corridor' | 'manual'
  const [selectedCorridor, setSelectedCorridor] = useState(0);
  const [corridorCount, setCorridorCount] = useState(1);
  const [manualOrigin, setManualOrigin] = useState(null);
  const [manualDest, setManualDest] = useState(null);
  const [manualName, setManualName] = useState('');
  const [scanning, setScanning] = useState(false);

  const maxTravelers = 20;
  const remaining = maxTravelers - travelerCount;

  // Track which corridor labels are active
  const activeLabels = new Set((activeTravelers || []).map(t => t.corridorLabel).filter(Boolean));

  const handleAddCorridor = () => {
    const c = CORRIDORS[selectedCorridor];
    const count = Math.min(corridorCount, remaining);
    for (let i = 0; i < count; i++) {
      const name = count === 1
        ? c.label
        : `${c.label} #${i + 1}`;
      onAddTraveler(c.from, c.to, name, c.defaultSpeedMph, 'manual', c.label);
    }
  };

  const handleAddManual = () => {
    if (!manualOrigin || !manualDest) return;
    const name = manualName.trim() || `Traveler ${travelerCount + 1}`;
    onAddTraveler(manualOrigin, manualDest, name, 65, 'manual', null);
    setManualName('');
    setManualOrigin(null);
    setManualDest(null);
  };

  const handleScanNws = async () => {
    setScanning(true);
    try { await onScanNws(); } finally { setScanning(false); }
  };

  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        className="absolute top-16 left-3 z-[600] bg-ww-surface/90 backdrop-blur-sm border border-ww-border rounded-lg p-2 hover:bg-ww-border transition-colors"
        title="Open setup panel"
      >
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </button>
    );
  }

  return (
    <div className="absolute top-16 left-3 z-[600] w-72 bg-ww-surface/95 backdrop-blur-sm border border-ww-border rounded-xl shadow-2xl shadow-black/30 max-h-[calc(100vh-5rem)] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-ww-border">
        <h3 className="text-white font-semibold text-sm">Add Travelers</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{travelerCount}/{maxTravelers}</span>
          <button onClick={onToggle} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Auto mode + NWS scan */}
      <div className="px-4 py-2 border-b border-ww-border flex items-center gap-2">
        <button
          onClick={onToggleAuto}
          className={`text-[11px] font-bold px-2 py-1 rounded transition-colors ${
            autoMode
              ? 'bg-green-600/30 text-green-400 hover:bg-green-600/40'
              : 'bg-gray-700/30 text-gray-500 hover:bg-gray-700/40'
          }`}
        >
          AUTO {autoMode ? 'ON' : 'OFF'}
        </button>
        <button
          onClick={handleScanNws}
          disabled={scanning}
          className="text-[11px] font-bold px-2 py-1 rounded bg-orange-600/30 text-orange-400 hover:bg-orange-600/40 transition-colors disabled:opacity-50"
        >
          {scanning ? 'Scanning...' : 'Scan NWS'}
        </button>
        {nwsAlertCount > 0 && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-600/30 text-red-400">
            {nwsAlertCount} alerts
          </span>
        )}
      </div>

      {/* Mode toggle */}
      <div className="flex border-b border-ww-border">
        <button
          onClick={() => setMode('corridor')}
          className={`flex-1 py-2 text-xs font-medium transition-colors ${mode === 'corridor' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-200'}`}
        >
          Presets
        </button>
        <button
          onClick={() => setMode('manual')}
          className={`flex-1 py-2 text-xs font-medium transition-colors ${mode === 'manual' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-200'}`}
        >
          Custom
        </button>
      </div>

      <div className="p-4 space-y-3">
        {mode === 'corridor' ? (
          <>
            {/* Corridor selector */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Highway Corridor</label>
              <select
                value={selectedCorridor}
                onChange={e => setSelectedCorridor(Number(e.target.value))}
                className="w-full bg-ww-dark border border-ww-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                {CORRIDORS.map((c, i) => (
                  <option key={i} value={i}>
                    {activeLabels.has(c.label) ? '● ' : ''}{c.label} ({c.defaultSpeedMph} mph)
                  </option>
                ))}
              </select>
            </div>

            {/* Count selector */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Travelers on this corridor</label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => setCorridorCount(n)}
                    disabled={n > remaining}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                      corridorCount === n
                        ? 'bg-blue-500 text-white'
                        : n > remaining
                          ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                          : 'bg-ww-dark text-gray-300 hover:bg-ww-border'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleAddCorridor}
              disabled={remaining <= 0}
              className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-all ${
                remaining > 0
                  ? 'bg-blue-600 hover:bg-blue-700 text-white active:scale-[0.98]'
                  : 'bg-gray-800 text-gray-600 cursor-not-allowed'
              }`}
            >
              Add {Math.min(corridorCount, remaining)} Traveler{Math.min(corridorCount, remaining) !== 1 ? 's' : ''}
            </button>
          </>
        ) : (
          <>
            {/* Manual input */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Name (optional)</label>
              <input
                type="text"
                value={manualName}
                onChange={e => setManualName(e.target.value)}
                placeholder={`Traveler ${travelerCount + 1}`}
                className="w-full bg-ww-dark border border-ww-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <LocationInput label="Origin" value={manualOrigin} onChange={setManualOrigin} placeholder="e.g., Lexington, KY" />
            <LocationInput label="Destination" value={manualDest} onChange={setManualDest} placeholder="e.g., London, KY" />
            <button
              onClick={handleAddManual}
              disabled={!manualOrigin || !manualDest || remaining <= 0}
              className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-all ${
                manualOrigin && manualDest && remaining > 0
                  ? 'bg-blue-600 hover:bg-blue-700 text-white active:scale-[0.98]'
                  : 'bg-gray-800 text-gray-600 cursor-not-allowed'
              }`}
            >
              Add Traveler
            </button>
          </>
        )}
      </div>
    </div>
  );
}
