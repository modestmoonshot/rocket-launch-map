import { fetchLaunches, fetchPads }  from './api.js';
import { runSimulation }             from './simulation.js';
import { getRocketConfig }           from './rockets.js';

// ── Map setup ─────────────────────────────────────────────────────────────────
let map;
let trajectoryLayer;

function initMap() {
  map = L.map('map').setView([20, 0], 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18,
  }).addTo(map);
  trajectoryLayer = L.layerGroup().addTo(map);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(isoStr) {
  if (!isoStr) return null;
  try {
    return new Date(isoStr).toUTCString().replace(' GMT', ' UTC');
  } catch {
    return isoStr;
  }
}

// ── Launch list ───────────────────────────────────────────────────────────────
function renderLaunchList(launches, pads) {
  const list = document.getElementById('launch-list');
  list.innerHTML = '';

  if (!launches.length) {
    list.innerHTML = '<p class="loading">No upcoming launches found.</p>';
    return;
  }

  for (const launch of launches) {
    const pad    = pads[launch.pad?.id];
    const config = getRocketConfig(launch.vehicle?.name || '');
    const t0Str  = formatTime(launch.t0 || launch.win_open);

    const card = document.createElement('div');
    card.className = 'launch-card';
    card.dataset.launchId = launch.id;

    const weatherHtml = launch.weather_condition
      ? `<div class="launch-weather">${launch.weather_condition} · ${launch.weather_temp ?? '--'}°F · Wind ${launch.weather_wind_mph ?? '--'} mph</div>`
      : '';

    card.innerHTML = `
      <div class="launch-name">${launch.name ?? 'Unknown launch'}</div>
      <div class="launch-vehicle">${launch.vehicle?.name ?? 'Unknown vehicle'} · ${launch.provider?.name ?? ''}</div>
      <div class="launch-site">📍 ${launch.pad?.location?.name ?? launch.pad?.name ?? 'Unknown site'}</div>
      <div class="launch-time">${t0Str ?? launch.date_str ?? 'Date TBD'}</div>
      ${weatherHtml}
    `;

    card.addEventListener('click', () => handleLaunchClick(launch, pad, config, card));
    list.appendChild(card);
  }
}

// ── Trajectory rendering ──────────────────────────────────────────────────────
const STAGE_COLORS = { 1: '#f97316', 2: '#3b82f6', 3: '#a855f7' };

function renderTrajectory(waypoints, launch, pad) {
  trajectoryLayer.clearLayers();
  if (!waypoints.length) return;

  // Draw stage-coloured polylines
  const segments = {};
  for (const wp of waypoints) {
    if (!segments[wp.stage]) segments[wp.stage] = [];
    segments[wp.stage].push([wp.lat, wp.lon]);
  }
  for (const [stage, pts] of Object.entries(segments)) {
    L.polyline(pts, {
      color:   STAGE_COLORS[stage] || '#94a3b8',
      weight:  2.5,
      opacity: 0.85,
    }).addTo(trajectoryLayer);
  }

  // Launch site marker
  const rocketIcon = L.divIcon({
    html: '🚀',
    className: '',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
  const t0Display = formatTime(launch.t0 || launch.win_open) ?? launch.date_str ?? 'TBD';
  L.marker([pad.lat, pad.lon], { icon: rocketIcon })
    .bindPopup(`<b>${launch.name}</b><br>${pad.name}<br>T-0: ${t0Display}`)
    .addTo(trajectoryLayer)
    .openPopup();

  // Milestone circle markers — every ~60 s plus first and last
  const milestones = waypoints.filter((wp, i) =>
    i === 0 || i === waypoints.length - 1 || wp.t_plus_s % 60 < 5
  );

  for (const wp of milestones) {
    const mins  = Math.floor(wp.t_plus_s / 60);
    const secs  = String(wp.t_plus_s % 60).padStart(2, '0');
    const color = STAGE_COLORS[wp.stage] || '#94a3b8';
    const ts    = wp.timestamp_utc
      ? `<small>${new Date(wp.timestamp_utc).toUTCString().replace(' GMT', ' UTC')}</small>`
      : '';

    L.circleMarker([wp.lat, wp.lon], {
      radius:      5,
      color,
      fillColor:   color,
      fillOpacity: 1,
      weight:      1.5,
    }).bindPopup(`
      <b>T+${mins}m ${secs}s</b><br>
      Alt: <b>${wp.alt_km} km</b><br>
      Speed: <b>${(wp.velocity_ms / 1000).toFixed(2)} km/s</b><br>
      Stage: ${wp.stage}<br>
      ${ts}
    `).addTo(trajectoryLayer);
  }

  // Fit map to trajectory
  try {
    const bounds = L.latLngBounds(waypoints.map(wp => [wp.lat, wp.lon]));
    map.fitBounds(bounds, { padding: [40, 40] });
  } catch {
    // Ignore if bounds are degenerate
  }
}

// ── Event handling ────────────────────────────────────────────────────────────
async function handleLaunchClick(launch, pad, config, card) {
  // Update selection state
  document.querySelectorAll('.launch-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  trajectoryLayer.clearLayers();

  if (!pad) {
    L.popup({ closeButton: false })
      .setLatLng(map.getCenter())
      .setContent('⚠️ Launch site coordinates not available for this pad.')
      .openOn(map);
    return;
  }

  document.getElementById('map-loading').style.display = 'flex';

  // Yield to browser so the spinner renders before the synchronous simulation
  await new Promise(r => setTimeout(r, 20));

  try {
    const launchTime = launch.t0 || launch.win_open || null;

    // Use config's default azimuth; simple heuristic for southern-hemisphere sites
    let azimuth = config.defaultAzimuth ?? 90;
    if (pad.lat < -10) azimuth = 180;   // southern launches typically go south (SSO)

    const waypoints = runSimulation(
      config,
      { lat: pad.lat, lon: pad.lon, azimuth },
      launchTime,
    );

    renderTrajectory(waypoints, launch, pad);
  } catch (err) {
    console.error('Simulation error:', err);
    L.popup({ closeButton: false })
      .setLatLng(map.getCenter())
      .setContent(`⚠️ Simulation error: ${err.message}`)
      .openOn(map);
  } finally {
    document.getElementById('map-loading').style.display = 'none';
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  initMap();

  const listEl = document.getElementById('launch-list');
  listEl.innerHTML = '<p class="loading">Loading launches…</p>';

  try {
    // Fetch launches first; pass them to fetchPads so it can pull any embedded
    // coordinates without an extra pads round-trip.
    const launches = await fetchLaunches();
    const pads     = await fetchPads(launches);
    renderLaunchList(launches, pads);
  } catch (err) {
    console.error('Init error:', err);
    listEl.innerHTML = `<p class="error">⚠️ Could not load launches:<br>${err.message}</p>`;
  }
}

init();
