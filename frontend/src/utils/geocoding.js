const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

let lastFetch = 0;
const MIN_INTERVAL = 1000; // 1 second rate limit for Nominatim

export async function searchLocations(query) {
  if (!query || query.length < 3) return [];

  const now = Date.now();
  const wait = MIN_INTERVAL - (now - lastFetch);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastFetch = Date.now();

  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      countrycodes: 'us',
      limit: '5',
      addressdetails: '1'
    });
    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.map(item => ({
      display: item.display_name,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon)
    }));
  } catch {
    return [];
  }
}
