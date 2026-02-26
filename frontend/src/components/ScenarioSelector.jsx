import { scenarios } from '../scenarios';

const hazardColors = {
  TORNADO: 'text-ww-red',
  FLASH_FLOOD: 'text-blue-400',
  BLIZZARD: 'text-cyan-300',
  WILDFIRE: 'text-orange-400',
  MULTIPLE: 'text-purple-400',
  NONE: 'text-ww-green',
};

const hazardLabels = {
  TORNADO: 'Tornado',
  FLASH_FLOOD: 'Flash Flood',
  BLIZZARD: 'Blizzard / Snow Storm',
  WILDFIRE: 'Wildfire / Smoke',
  MULTIPLE: 'Multi-Hazard',
  NONE: 'Clear Weather',
};

export default function ScenarioSelector({ selected, onSelect }) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-3">Select a Scenario</label>
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {scenarios.map((s) => {
          const isSelected = selected?.id === s.id;
          return (
            <div
              key={s.id}
              onClick={() => onSelect(s)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onSelect(s)}
              className={`flex items-center gap-3 w-full text-left px-4 py-3 rounded-lg border cursor-pointer transition-all select-none ${
                isSelected
                  ? 'border-blue-500 bg-blue-500/10 text-white'
                  : 'border-ww-border bg-ww-dark text-gray-300 hover:border-gray-500 hover:bg-ww-border/30'
              }`}
              style={{ minHeight: 'unset', minWidth: 'unset' }}
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{s.name}</div>
                <div className={`text-xs mt-0.5 ${hazardColors[s.hazard] || 'text-gray-500'}`}>
                  {hazardLabels[s.hazard] || s.hazard}
                </div>
              </div>
              {isSelected && (
                <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
