import { rk4Step } from './physics.js';

const R_EARTH = 6371000;   // m
const DEG     = Math.PI / 180;
const P0      = 101325;    // Pa sea-level pressure

// ── Pitch program ──────────────────────────────────────────────────────────────
// Open-loop pitch schedule (flight path angle from horizontal, degrees vs T+ seconds).
// Prevents the gravity-turn equation from pitching over too aggressively at low speed.
// Once the gravity turn naturally falls below this schedule the vehicle follows the
// gravity turn instead — the program just sets an upper bound.
const PITCH_PROGRAM = [
  [  0, 90],   // vertical at liftoff
  [ 10, 90],   // hold vertical for tower clearance
  [ 30, 87],   // begin very gentle pitch-over
  [ 60, 75],   // ~T+1min: 15° from vertical
  [ 90, 55],   // ~T+1.5min: 35° from vertical
  [130, 20],   // ~T+2.2min: approaching gravity turn
  [180,  3],   // approaching MECO angle
  [240,  1],   // Stage 2 burns nearly horizontal
  [700,  0.5], // coast / upper-stage insertion burn
];

function commandedGamma(t) {
  const prog = PITCH_PROGRAM;
  if (t <= prog[0][0]) return prog[0][1] * DEG;
  if (t >= prog[prog.length - 1][0]) return prog[prog.length - 1][1] * DEG;
  for (let i = 0; i < prog.length - 1; i++) {
    if (t >= prog[i][0] && t < prog[i + 1][0]) {
      const alpha = (t - prog[i][0]) / (prog[i + 1][0] - prog[i][0]);
      return (prog[i][1] + alpha * (prog[i + 1][1] - prog[i][1])) * DEG;
    }
  }
  return 0;
}

// ── Coordinate conversion ──────────────────────────────────────────────────────
// Convert a downrange arc angle (θ, radians from Earth centre) and a launch
// azimuth into geographic lat/lon using spherical-Earth haversine-style math.
// origin: (lat0_deg, lon0_deg), azimuth: degrees clockwise from north
function polarToGeo(lat0_deg, lon0_deg, azimuth_deg, downrangeAngle) {
  const lat0 = lat0_deg * DEG;
  const lon0 = lon0_deg * DEG;
  const az   = azimuth_deg * DEG;
  const d    = downrangeAngle;   // arc radians

  const sinLat = Math.sin(lat0) * Math.cos(d)
               + Math.cos(lat0) * Math.sin(d) * Math.cos(az);
  const lat    = Math.asin(Math.max(-1, Math.min(1, sinLat)));
  const lon    = lon0 + Math.atan2(
    Math.sin(az) * Math.sin(d) * Math.cos(lat0),
    Math.cos(d) - Math.sin(lat0) * Math.sin(lat)
  );

  return { lat: lat / DEG, lon: lon / DEG };
}

// ── Main simulation ────────────────────────────────────────────────────────────
// rocketConfig — from rockets.js
// launchSite   — { lat, lon, azimuth, alt_m? }
// launchTimeISO — ISO 8601 string for T-0 (used to stamp waypoints)
export function runSimulation(rocketConfig, launchSite, launchTimeISO) {
  const { lat, lon, azimuth }                                  = launchSite;
  const { stages, refArea, cdCurve, payloadMass = 0,
          targetOrbitAlt = 400000 }                            = rocketConfig;

  // Total liftoff mass
  const totalMass = stages.reduce((s, st) => s + st.dryMass + st.propMass, 0)
                  + payloadMass;

  // Initial state: [r, v, gamma, theta, m]
  // Start at v=1 m/s so derivatives have no divide-by-zero issues
  let state = [R_EARTH + (launchSite.alt_m || 10), 1.0, Math.PI / 2, 0, totalMass];

  let t           = 0;
  let stageIdx    = 0;
  const waypoints = [];
  const MAX_T     = 700;           // s  (~11 min, covers most LEO insertion burns)
  const WP_INTERVAL = 5;           // s  record a waypoint every 5 sim-seconds

  while (t < MAX_T) {
    const h = state[0] - R_EARTH;

    // ── Stage separation ────────────────────────────────────────────────────
    while (stageIdx < stages.length - 1
        && t >= stages[stageIdx].separationTime) {
      state[4] = Math.max(state[4] - stages[stageIdx].dryMass, 1);
      stageIdx++;
    }

    const currentStage = stages[Math.min(stageIdx, stages.length - 1)];

    // Dry mass of all remaining stages + payload (lower bound on vehicle mass)
    const remainingDry = stages.slice(stageIdx)
                               .reduce((s, st) => s + st.dryMass, 0)
                       + payloadMass;

    // Floor below which current-stage propellant is exhausted:
    // = all downstream stages (wet) + current stage dry + payload
    const currentStagePropFloor = stages.slice(stageIdx + 1)
                                        .reduce((s, st) => s + st.dryMass + st.propMass, 0)
                                + stages[stageIdx].dryMass
                                + payloadMass;

    const engine = {
      active:    state[4] > currentStagePropFloor + 100,   // current-stage propellant remains
      dryMass:   remainingDry,
      // Upper stages fire in vacuum — zero sea-level thrust/Isp
      thrustSL:  stageIdx === 0 ? currentStage.thrustSL  : 0,
      thrustVac: currentStage.thrustVac,
      ispSL:     stageIdx === 0 ? currentStage.ispSL     : currentStage.ispVac,
      ispVac:    currentStage.ispVac,
      refArea,
      cdCurve,
    };

    // ── MECO conditions ────────────────────────────────────────────────────
    const GM_EARTH   = 3.986004418e14;
    const vTargetOrb = Math.sqrt(GM_EARTH / (R_EARTH + targetOrbitAlt));
    // Cut when target orbital velocity reached (upper stage only)
    if (stageIdx >= 1 && state[1] >= vTargetOrb * 0.98) {
      engine.active = false;
    }
    // Also cut if at or above target altitude with shallow angle
    if (h >= targetOrbitAlt && Math.abs(state[2]) < 0.15) {
      engine.active = false;
    }

    // ── Guidance ───────────────────────────────────────────────────────────
    // 1. Pitch program: upper bound during ascent (prevents premature pitch-over)
    const gammaMax = commandedGamma(t);
    if (state[2] > gammaMax) state[2] = gammaMax;

    // 2. Climb floor: while engine is burning and below target orbit, hold a
    //    minimum flight path angle so the vehicle keeps gaining altitude.
    //    (Simulates FCS guidance that prevents diving back into atmosphere.)
    if (engine.active) {
      if (h < targetOrbitAlt) {
        // Maintain at least 2° nose-up below target orbit altitude
        if (state[2] < 2 * DEG) state[2] = 2 * DEG;
      } else {
        // At or above target orbit: allow shallow descent (circularisation)
        if (state[2] < 0) state[2] = 0;
      }
    }

    // ── Integrate ──────────────────────────────────────────────────────────
    const dt = h < 120000 ? 0.5 : 2.0;
    state = rk4Step(state, dt, engine, P0);
    t    += dt;

    // ── Record waypoint ────────────────────────────────────────────────────
    const prevT = waypoints.length > 0 ? waypoints[waypoints.length - 1]._t : -Infinity;
    if (t - prevT >= WP_INTERVAL) {
      const geo   = polarToGeo(lat, lon, azimuth, state[3]);
      const altKm = (state[0] - R_EARTH) / 1000;
      const t0Ms  = launchTimeISO ? new Date(launchTimeISO).getTime() : 0;

      waypoints.push({
        _t:            t,
        t_plus_s:      Math.round(t),
        timestamp_utc: t0Ms ? new Date(t0Ms + t * 1000).toISOString() : null,
        lat:           Math.round(geo.lat * 10000) / 10000,
        lon:           Math.round(geo.lon * 10000) / 10000,
        alt_km:        Math.round(altKm * 10) / 10,
        velocity_ms:   Math.round(state[1]),
        stage:         stageIdx + 1,
      });
    }

    // ── Abort conditions ───────────────────────────────────────────────────
    if (state[0] < R_EARTH - 5000)         break;  // crashed
    if (h > targetOrbitAlt + 50000)        break;  // well past target
  }

  // Remove internal _t field before returning
  return waypoints.map(({ _t, ...wp }) => wp);
}
