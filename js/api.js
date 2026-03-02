const API_BASE = 'https://fdo.rocketlaunch.live/json';
const API_KEY  = '__ROCKETLAUNCH_API_KEY__';

// ── Launches ──────────────────────────────────────────────────────────────────
// Fetch the next N upcoming launches from rocketlaunch.live
export async function fetchLaunches(count = 5) {
  const res = await fetch(`${API_BASE}/launches/next/${count}?key=${API_KEY}`);
  if (!res.ok) throw new Error(`Launches API error ${res.status}: ${res.statusText}`);
  const data = await res.json();
  return data.result || [];
}

// ── Pads ──────────────────────────────────────────────────────────────────────
// Build a pad-id → { lat, lon, name } lookup map.
// Strategy:
//   1. Pull coordinates from launch.pad.location if already embedded.
//   2. For any pads still missing coordinates, paginate the /pads endpoint.
//
// Accepts an optional launches array so we can skip the pads API entirely when
// the launches response already carries full location data.
export async function fetchPads(launches = []) {
  const padMap = {};

  // ── Pass 1: extract from embedded launch data ─────────────────────────────
  for (const launch of launches) {
    const pad = launch.pad;
    if (!pad?.id) continue;
    if (padMap[pad.id]) continue;          // already resolved

    // rocketlaunch.live may embed coordinates directly on pad.location
    const loc = pad.location;
    if (loc) {
      const lat = parseFloat(loc.latitude  ?? loc.lat);
      const lon = parseFloat(loc.longitude ?? loc.lon ?? loc.lng);
      if (!isNaN(lat) && !isNaN(lon)) {
        padMap[pad.id] = {
          lat,
          lon,
          name: pad.full_name || loc.name || pad.name || 'Unknown pad',
        };
      }
    }
  }

  // ── Pass 2: for any still-missing pads, query /pads endpoint ─────────────
  const missingIds = [...new Set(
    launches.map(l => l.pad?.id).filter(id => id != null && !padMap[id])
  )];

  if (missingIds.length > 0) {
    let page = 1;
    const MAX_PAGES = 20;          // safety ceiling

    while (page <= MAX_PAGES && missingIds.some(id => !padMap[id])) {
      const res = await fetch(`${API_BASE}/pads?key=${API_KEY}&page=${page}`);
      if (!res.ok) break;
      const data = await res.json();

      for (const pad of data.result || []) {
        const loc = pad.location;
        if (loc?.latitude && loc?.longitude) {
          padMap[pad.id] = {
            lat:  parseFloat(loc.latitude),
            lon:  parseFloat(loc.longitude),
            name: pad.full_name || pad.name || 'Unknown pad',
          };
        }
      }

      if (page >= (data.last_page || 1)) break;
      page++;
    }
  }

  return padMap;
}
