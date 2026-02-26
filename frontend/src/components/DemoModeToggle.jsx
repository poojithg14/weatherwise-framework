export default function DemoModeToggle({ isDemo, onToggle }) {
  return (
    <div className="flex items-center gap-4">
      <span
        className={`text-sm cursor-pointer select-none ${!isDemo ? 'text-white font-semibold' : 'text-gray-500'}`}
        onClick={() => isDemo && onToggle()}
      >
        Real Mode
      </span>
      <button
        type="button"
        onClick={onToggle}
        className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-ww-dark ${
          isDemo ? 'bg-blue-600' : 'bg-gray-600'
        }`}
        style={{ minHeight: 'unset', minWidth: 'unset' }}
        aria-label={isDemo ? 'Switch to real mode' : 'Switch to demo mode'}
        role="switch"
        aria-checked={isDemo}
      >
        <span
          className={`inline-block h-6 w-6 rounded-full bg-white shadow-lg transform transition-transform duration-200 ease-in-out ${
            isDemo ? 'translate-x-9' : 'translate-x-1'
          }`}
        />
      </button>
      <span
        className={`text-sm cursor-pointer select-none ${isDemo ? 'text-white font-semibold' : 'text-gray-500'}`}
        onClick={() => !isDemo && onToggle()}
      >
        Demo Mode
      </span>
    </div>
  );
}
