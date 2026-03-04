import { useState, useRef, useEffect } from 'react';
import { useGeocoding } from '../hooks/useGeocoding';

export default function LocationInput({ label, value, onChange, placeholder }) {
  const [query, setQuery] = useState(value?.label || '');
  const [showDropdown, setShowDropdown] = useState(false);
  const { results, loading, search, clear } = useGeocoding();
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    search(val);
    setShowDropdown(true);
  };

  const handleSelect = (loc) => {
    setQuery(loc.display);
    onChange({ lat: loc.lat, lon: loc.lon, label: loc.display });
    setShowDropdown(false);
    clear();
  };

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-sm text-gray-400 mb-1">{label}</label>
      <input
        type="text"
        value={query}
        onChange={handleInput}
        onFocus={() => results.length > 0 && setShowDropdown(true)}
        placeholder={placeholder || 'Search a location...'}
        className="w-full bg-ww-dark border border-ww-border rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
      />
      {loading && (
        <div className="absolute right-3 top-9">
          <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {showDropdown && results.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-ww-surface border border-ww-border rounded-lg shadow-xl max-h-48 overflow-y-auto">
          {results.map((loc, i) => (
            <li
              key={i}
              onClick={() => handleSelect(loc)}
              className="px-4 py-3 text-sm text-gray-200 hover:bg-ww-dark cursor-pointer border-b border-ww-border last:border-b-0"
            >
              {loc.display}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
