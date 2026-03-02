# Rocket Launch Map Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a pure-static website that fetches upcoming rocket launches from rocketlaunch.live, runs a 3DOF point-mass physics simulation for each vehicle, and plots the trajectory as interactive timestamped waypoints on a Leaflet.js map.

**Architecture:** All computation runs in the browser as ES modules loaded via `<script type="module">`. Physics is split into focused modules (atmosphere → physics → simulation) tested with QUnit in a browser test harness. The app module wires the API, simulation, and map together. No build tools, no npm — serve with `python3 -m http.server 8080`.

**Tech Stack:** Vanilla JavaScript ES modules, Leaflet.js (CDN), OpenStreetMap tiles, QUnit (CDN, tests only), rocketlaunch.live REST API.

---

### Task 1: Project Scaffold + QUnit Test Harness

**Files:**
- Create: `rocket-launch-map/index.html`
- Create: `rocket-launch-map/css/style.css`
- Create: `rocket-launch-map/js/atmosphere.js`
- Create: `rocket-launch-map/js/physics.js`
- Create: `rocket-launch-map/js/rockets.js`
- Create: `rocket-launch-map/js/simulation.js`
- Create: `rocket-launch-map/js/api.js`
- Create: `rocket-launch-map/js/app.js`
- Create: `rocket-launch-map/tests/test.html`

**Step 1: Create the shell index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rocket Launch Map</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <link rel="stylesheet" href="css/style.css" />
</head>
<body>
  <div id="sidebar">
    <h1>Upcoming Launches</h1>
    <div id="launch-list"><p class="loading">Loading launches…</p></div>
  </div>
  <div id="map-container">
    <div id="map"></div>
    <div id="map-loading" style="display:none">
      <div class="spinner"></div>
      <span>Simulating trajectory…</span>
    </div>
  </div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script type="module" src="js/app.js"></script>
</body>
</html>
```

**Step 2: Create css/style.css (base layout only for now)**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  display: flex;
  height: 100vh;
  font-family: system-ui, sans-serif;
  background: #0f172a;
  color: #e2e8f0;
}

#sidebar {
  width: 300px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #1e293b;
  overflow-y: auto;
  padding: 16px;
  gap: 8px;
}

#sidebar h1 {
  font-size: 1rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #94a3b8;
  margin-bottom: 8px;
}

#map-container {
  flex: 1;
  position: relative;
}

#map { width: 100%; height: 100%; }

#map-loading {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 0.9rem;
  color: #94a3b8;
  z-index: 1000;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #334155;
  border-top-color: #f97316;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.launch-card {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: border-color 0.15s;
}

.launch-card:hover { border-color: #f97316; }
.launch-card.selected { border-color: #f97316; background: #1c1917; }
.launch-card.unavailable { opacity: 0.5; cursor: not-allowed; }

.launch-name { font-weight: 600; font-size: 0.9rem; margin-bottom: 4px; }
.launch-vehicle { font-size: 0.75rem; color: #f97316; margin-bottom: 2px; }
.launch-site { font-size: 0.75rem; color: #94a3b8; }
.launch-time { font-size: 0.7rem; color: #64748b; margin-top: 4px; }
.launch-unavailable-msg { font-size: 0.7rem; color: #ef4444; margin-top: 4px; }

.loading { color: #64748b; font-size: 0.85rem; }
.error { color: #ef4444; font-size: 0.85rem; }
```

**Step 3: Create stub JS files so imports don't fail**

`js/atmosphere.js` — empty export:
```javascript
export function getAtmosphere(h_m) { return {}; }
```

`js/physics.js` — empty exports:
```javascript
export function derivatives(state, engine, p0) { return [0,0,0,0,0]; }
export function rk4Step(state, dt, engine, p0) { return state; }
```

`js/rockets.js` — empty export:
```javascript
export function getRocketConfig(vehicleName) { return null; }
```

`js/simulation.js` — empty export:
```javascript
export function runSimulation(config, launchSite, launchTime) { return []; }
```

`js/api.js` — empty exports:
```javascript
export async function fetchLaunches() { return []; }
export async function fetchPads() { return {}; }
```

`js/app.js` — minimal init:
```javascript
import { fetchLaunches, fetchPads } from './api.js';

async function init() {
  const map = L.map('map').setView([28.6, -80.6], 3);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  document.getElementById('launch-list').innerHTML = '<p class="loading">Scaffold complete.</p>';
}

init();
```

**Step 4: Create the QUnit test harness**

`tests/test.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Rocket Launch Map — Tests</title>
  <link rel="stylesheet" href="https://code.jquery.com/qunit/qunit-2.20.0.css">
</head>
<body>
  <div id="qunit"></div>
  <div id="qunit-fixture"></div>
  <script src="https://code.jquery.com/qunit/qunit-2.20.0.js"></script>
  <script type="module">
    // Tests will be added here incrementally
    QUnit.module('Scaffold', () => {
      QUnit.test('test harness works', assert => {
        assert.ok(true, 'QUnit is running');
      });
    });
  </script>
</body>
</html>
```

**Step 5: Verify scaffold in browser**

```bash
cd "/Users/mikesteward/Claude Projects/rocket-launch-map"
python3 -m http.server 8080
```

Open `http://localhost:8080` — expect: dark two-panel layout, map renders with OpenStreetMap tiles, sidebar shows "Scaffold complete."
Open `http://localhost:8080/tests/test.html` — expect: 1 test passing ("test harness works").

**Step 6: Commit**

```bash
cd "/Users/mikesteward/Claude Projects/rocket-launch-map"
git init
git add .
git commit -m "feat: project scaffold with layout, stub modules, QUnit harness"
```

---

### Task 2: Atmosphere Module (USSA-1976)

**Files:**
- Modify: `rocket-launch-map/js/atmosphere.js`
- Modify: `rocket-launch-map/tests/test.html` (add atmosphere tests)

The US Standard Atmosphere 1976 defines 7 altitude layers with known base temperature, pressure, and lapse rate. This module returns air density, pressure, temperature, and speed of sound at any altitude 0–86 km.

**Step 1: Write the failing atmosphere tests**

Add to the `<script type="module">` block in `tests/test.html`:

```javascript
import { getAtmosphere } from '../js/atmosphere.js';

QUnit.module('Atmosphere (USSA-1976)', () => {
  QUnit.test('sea level values match standard', assert => {
    const atm = getAtmosphere(0);
    assert.close(atm.pressure_pa, 101325, 1, 'sea level pressure ≈ 101325 Pa');
    assert.close(atm.temperature_k, 288.15, 0.01, 'sea level temp = 288.15 K');
    assert.close(atm.density_kgm3, 1.225, 0.005, 'sea level density ≈ 1.225 kg/m³');
    assert.close(atm.speed_of_sound_ms, 340.3, 0.5, 'sea level SoS ≈ 340 m/s');
  });

  QUnit.test('tropopause (11000 m) temperature', assert => {
    const atm = getAtmosphere(11000);
    assert.close(atm.temperature_k, 216.65, 0.1, 'tropopause = 216.65 K');
  });

  QUnit.test('pressure decreases with altitude', assert => {
    const low = getAtmosphere(1000);
    const high = getAtmosphere(10000);
    assert.ok(high.pressure_pa < low.pressure_pa, 'pressure drops with altitude');
  });

  QUnit.test('density near zero at 80 km', assert => {
    const atm = getAtmosphere(80000);
    assert.ok(atm.density_kgm3 < 0.001, 'near-vacuum at 80 km');
  });

  QUnit.test('above 86 km returns zero density', assert => {
    const atm = getAtmosphere(90000);
    assert.strictEqual(atm.density_kgm3, 0, 'vacuum above 86 km');
  });

  QUnit.test('negative altitude clamps to sea level', assert => {
    const atm = getAtmosphere(-500);
    assert.close(atm.pressure_pa, 101325, 1, 'negative alt treated as 0');
  });
});
```

Also add the `assert.close` helper (QUnit doesn't include it by default) before the module blocks:
```javascript
QUnit.assert.close = function(actual, expected, delta, message) {
  const passed = Math.abs(actual - expected) <= delta;
  this.pushResult({ result: passed, actual, expected: `${expected} ± ${delta}`, message });
};
```

**Step 2: Open tests — verify atmosphere tests FAIL**

Open `http://localhost:8080/tests/test.html`.
Expected: atmosphere tests fail because `getAtmosphere` returns `{}`.

**Step 3: Implement atmosphere.js**

```javascript
// US Standard Atmosphere 1976
// Ref: COESA 1976, ISO 2533:1975

const R_AIR = 287.058;   // J/(kg·K) specific gas constant for dry air
const GAMMA = 1.4;       // ratio of specific heats
const G0    = 9.80665;   // m/s² standard gravity

// Layer table: [base_alt_m, base_temp_K, lapse_rate_K/m, base_pressure_Pa]
const LAYERS = [
  [    0, 288.15, -0.0065, 101325.0],
  [11000, 216.65,  0.0,    22632.1 ],
  [20000, 216.65,  0.001,  5474.89 ],
  [32000, 228.65,  0.0028,  868.019],
  [47000, 270.65,  0.0,     110.906],
  [51000, 270.65, -0.0028,   66.9389],
  [71000, 214.65, -0.002,    3.95642],
];

export function getAtmosphere(h_m) {
  if (h_m < 0) h_m = 0;
  if (h_m > 86000) {
    return { pressure_pa: 0, density_kgm3: 0, temperature_k: 186.87, speed_of_sound_ms: 273.6 };
  }

  // Find the layer this altitude belongs to
  let layer = LAYERS[0];
  for (let i = LAYERS.length - 1; i >= 0; i--) {
    if (h_m >= LAYERS[i][0]) { layer = LAYERS[i]; break; }
  }

  const [h_base, T_base, L, p_base] = layer;
  const dh = h_m - h_base;

  let T, p;
  if (Math.abs(L) < 1e-10) {
    // Isothermal layer: exponential pressure decay
    T = T_base;
    p = p_base * Math.exp((-G0 * dh) / (R_AIR * T));
  } else {
    // Gradient layer: power-law pressure
    T = T_base + L * dh;
    p = p_base * Math.pow(T / T_base, -G0 / (L * R_AIR));
  }

  const rho = p / (R_AIR * T);
  const a   = Math.sqrt(GAMMA * R_AIR * T);   // speed of sound

  return {
    pressure_pa:      p,
    density_kgm3:     rho,
    temperature_k:    T,
    speed_of_sound_ms: a,
  };
}
```

**Step 4: Verify atmosphere tests PASS**

Reload `http://localhost:8080/tests/test.html`.
Expected: all 6 atmosphere tests pass.

**Step 5: Commit**

```bash
git add js/atmosphere.js tests/test.html
git commit -m "feat: implement USSA-1976 atmosphere model with passing tests"
```

---

### Task 3: Physics Module (Forces + RK4 Integrator)

**Files:**
- Modify: `rocket-launch-map/js/physics.js`
- Modify: `rocket-launch-map/tests/test.html`

**Step 1: Write the failing physics tests**

Add to `tests/test.html` (after atmosphere tests):

```javascript
import { derivatives, rk4Step } from '../js/physics.js';

QUnit.module('Physics', () => {
  const R_EARTH = 6371000;

  // A minimal engine config for testing
  const engine = {
    active: true,
    dryMass: 5000,
    thrustSL: 500000,
    thrustVac: 550000,
    ispSL: 280,
    ispVac: 320,
    refArea: 10,
    cdCurve: [[0, 0.3], [1, 0.5], [3, 0.3], [8, 0.2]],
  };

  const p0 = 101325;

  QUnit.test('at sea level vertical ascent: dv/dt is positive (net upward thrust)', assert => {
    // State: at sea level, low speed, 90° (straight up), mass includes plenty of propellant
    const state = [R_EARTH, 10, Math.PI / 2, 0, 500000];
    const d = derivatives(state, engine, p0);
    assert.ok(d[1] > 0, `dv/dt = ${d[1].toFixed(2)} should be positive (thrust > drag + gravity)`);
  });

  QUnit.test('dr/dt equals v * sin(gamma)', assert => {
    const state = [R_EARTH + 10000, 500, Math.PI / 4, 0, 100000];
    const d = derivatives(state, engine, p0);
    const expected = 500 * Math.sin(Math.PI / 4);
    assert.close(d[0], expected, 0.01, 'dr/dt = v·sin(γ)');
  });

  QUnit.test('dm/dt is negative when engine is burning', assert => {
    const state = [R_EARTH, 10, Math.PI / 2, 0, 500000];
    const d = derivatives(state, engine, p0);
    assert.ok(d[4] < 0, 'mass decreases while burning');
  });

  QUnit.test('thrust is zero when engine is off', assert => {
    const offEngine = { ...engine, active: false };
    const state = [R_EARTH + 200000, 7800, 0.05, 0.1, 10000];
    const d = derivatives(state, offEngine, p0);
    // With no thrust, dm/dt should be 0
    assert.strictEqual(d[4], 0, 'no mass flow when engine off');
  });

  QUnit.test('rk4Step preserves state length', assert => {
    const state = [R_EARTH, 10, Math.PI / 2, 0, 500000];
    const newState = rk4Step(state, 0.5, engine, p0);
    assert.strictEqual(newState.length, 5, 'state stays 5-element');
  });

  QUnit.test('rk4Step: altitude increases during vertical ascent', assert => {
    const state = [R_EARTH, 100, Math.PI / 2, 0, 500000];
    const newState = rk4Step(state, 0.5, engine, p0);
    assert.ok(newState[0] > state[0], 'r increases when heading upward');
  });

  QUnit.test('Cd interpolation: subsonic', assert => {
    // mach 0.5 → Cd should be between 0.3 and 0.5 (linearly: 0.4)
    // We'll test by checking drag is non-zero at low speed
    const state = [R_EARTH, 150, Math.PI / 2, 0, 500000]; // ~mach 0.44
    const d = derivatives(state, engine, p0);
    // drag term pushes dv down vs no-drag case
    const engineHighThrust = { ...engine, thrustSL: 1e9, thrustVac: 1e9 };
    const dHighThrust = derivatives(state, engineHighThrust, p0);
    assert.ok(dHighThrust[1] > d[1], 'more thrust gives higher dv/dt (sanity check)');
  });
});
```

**Step 2: Verify tests FAIL**

Reload tests page. Expected: physics tests fail (stubs return zeros).

**Step 3: Implement physics.js**

```javascript
import { getAtmosphere } from './atmosphere.js';

const GM      = 3.986004418e14;  // m³/s² Earth gravitational parameter
const R_EARTH = 6371000;         // m mean Earth radius
const G0      = 9.80665;         // m/s² standard gravity (for Isp calculation)

// Linearly interpolate Cd from a [[mach, cd], ...] breakpoint table
function interpolateCd(mach, cdCurve) {
  if (mach <= cdCurve[0][0]) return cdCurve[0][1];
  if (mach >= cdCurve[cdCurve.length - 1][0]) return cdCurve[cdCurve.length - 1][1];
  for (let i = 0; i < cdCurve.length - 1; i++) {
    if (mach >= cdCurve[i][0] && mach < cdCurve[i + 1][0]) {
      const t = (mach - cdCurve[i][0]) / (cdCurve[i + 1][0] - cdCurve[i][0]);
      return cdCurve[i][1] + t * (cdCurve[i + 1][1] - cdCurve[i][1]);
    }
  }
  return cdCurve[0][1];
}

// Returns state derivatives: [dr, dv, dgamma, dtheta, dm]
// state = [r, v, gamma, theta, m]
// engine = { active, dryMass, thrustSL, thrustVac, ispSL, ispVac, refArea, cdCurve }
// p0 = sea-level pressure (Pa), used for thrust correction
export function derivatives(state, engine, p0) {
  const [r, v, gamma, theta, m] = state;
  const h = r - R_EARTH;

  const atmos = getAtmosphere(Math.max(0, h));
  const g = GM / (r * r);

  // Thrust and mass flow
  let thrust = 0;
  let mdot   = 0;
  if (engine && engine.active && m > (engine.dryMass || 0)) {
    const pRatio = p0 > 0 ? atmos.pressure_pa / p0 : 0;
    thrust = engine.thrustVac + (engine.thrustSL - engine.thrustVac) * pRatio;
    const isp = engine.ispVac + (engine.ispSL - engine.ispVac) * pRatio;
    mdot = thrust / (isp * G0);
  }

  // Aerodynamic drag
  const safeV = Math.max(v, 0.01);
  const mach  = safeV / Math.max(atmos.speed_of_sound_ms, 1);
  const cdCurve = engine?.cdCurve || [[0, 0.3], [1, 0.5], [3, 0.3], [8, 0.2]];
  const cd   = interpolateCd(mach, cdCurve);
  const area = engine?.refArea || 10;
  const drag = 0.5 * atmos.density_kgm3 * v * v * area * cd;

  // Equations of motion (polar 3DOF)
  const dr     = v * Math.sin(gamma);
  const dv     = (thrust - drag) / m - g * Math.sin(gamma);
  const dgamma = (v / r - g / Math.max(v, 0.01)) * Math.cos(gamma);
  const dtheta = v * Math.cos(gamma) / r;
  const dm     = -mdot;

  return [dr, dv, dgamma, dtheta, dm];
}

// 4th-order Runge-Kutta step
export function rk4Step(state, dt, engine, p0) {
  const k1 = derivatives(state, engine, p0);
  const s2 = state.map((s, i) => s + 0.5 * dt * k1[i]);
  const k2 = derivatives(s2, engine, p0);
  const s3 = state.map((s, i) => s + 0.5 * dt * k2[i]);
  const k3 = derivatives(s3, engine, p0);
  const s4 = state.map((s, i) => s + dt * k3[i]);
  const k4 = derivatives(s4, engine, p0);
  return state.map((s, i) => s + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}
```

**Step 4: Verify physics tests PASS**

Reload `http://localhost:8080/tests/test.html`.
Expected: all physics tests pass.

**Step 5: Commit**

```bash
git add js/physics.js tests/test.html
git commit -m "feat: implement RK4 integrator and 3DOF force model with passing tests"
```

---

### Task 4: Rocket Configuration Database

**Files:**
- Modify: `rocket-launch-map/js/rockets.js`

No unit tests needed here — this is static data. Correctness is validated by visual trajectory inspection in Task 9.

**Step 1: Implement rockets.js**

```javascript
// Rocket configuration database
// Matched to rocketlaunch.live vehicle names (case-insensitive substring match)
// Sources: Wikipedia, NASA SMA data sheets, manufacturer specs

// Default Cd curve: generic orbital launch vehicle shape
const DEFAULT_CD = [[0, 0.30], [0.8, 0.35], [1.0, 0.50], [1.5, 0.40], [3.0, 0.30], [6.0, 0.22], [10.0, 0.18]];

const ROCKETS = [
  {
    match: ['falcon 9'],
    name: 'Falcon 9 Block 5',
    refArea: 10.75,        // m² (3.7m diameter)
    cdCurve: DEFAULT_CD,
    payloadMass: 10000,    // kg (representative LEO payload)
    defaultAzimuth: 53,    // degrees from north (mid-inclination, Starlink typical)
    targetOrbitAlt: 550000, // m (550 km Starlink shell)
    stages: [
      {
        name: 'Stage 1',
        thrustSL:  7607000,  // N  (9x Merlin 1D sea-level)
        thrustVac: 8227000,  // N  (9x Merlin 1D vacuum)
        ispSL:     282,      // s
        ispVac:    311,      // s
        dryMass:   22200,    // kg
        propMass:  409500,   // kg (LOX/RP-1)
        separationTime: 162, // s T+ (MECO-1 ~T+2:42)
      },
      {
        name: 'Stage 2',
        thrustSL:  0,
        thrustVac: 981000,   // N  (1x Merlin 1D Vacuum)
        ispSL:     311,
        ispVac:    348,
        dryMass:   4000,     // kg
        propMass:  111500,   // kg
        separationTime: 9999,
      },
    ],
  },
  {
    match: ['falcon heavy'],
    name: 'Falcon Heavy',
    refArea: 10.75,
    cdCurve: DEFAULT_CD,
    payloadMass: 20000,
    defaultAzimuth: 28.5,
    targetOrbitAlt: 400000,
    stages: [
      {
        name: 'Stage 1 (3 cores)',
        thrustSL:  22819000,
        thrustVac: 24681000,
        ispSL:     282,
        ispVac:    311,
        dryMass:   66600,
        propMass:  1228500,
        separationTime: 162,
      },
      {
        name: 'Stage 2',
        thrustSL:  0,
        thrustVac: 981000,
        ispSL:     311,
        ispVac:    348,
        dryMass:   4000,
        propMass:  111500,
        separationTime: 9999,
      },
    ],
  },
  {
    match: ['starship'],
    name: 'Starship / Super Heavy',
    refArea: 78.5,        // m² (10m diameter)
    cdCurve: [[0, 0.35], [0.8, 0.45], [1.0, 0.60], [1.5, 0.45], [3.0, 0.35], [6.0, 0.28]],
    payloadMass: 100000,
    defaultAzimuth: 90,
    targetOrbitAlt: 250000,
    stages: [
      {
        name: 'Super Heavy',
        thrustSL:  74000000,  // N  (33x Raptor 2, approx)
        thrustVac: 82000000,
        ispSL:     327,
        ispVac:    363,
        dryMass:   200000,
        propMass:  3400000,
        separationTime: 170,
      },
      {
        name: 'Starship (Ship)',
        thrustSL:  0,
        thrustVac: 13000000,   // N  (6x Raptor Vacuum)
        ispSL:     350,
        ispVac:    380,
        dryMass:   100000,
        propMass:  1200000,
        separationTime: 9999,
      },
    ],
  },
  {
    match: ['electron'],
    name: 'Electron',
    refArea: 0.95,         // m² (1.2m diameter)
    cdCurve: DEFAULT_CD,
    payloadMass: 200,
    defaultAzimuth: 180,   // Mahia, NZ — southward to SSO
    targetOrbitAlt: 500000,
    stages: [
      {
        name: 'Stage 1',
        thrustSL:  190000,
        thrustVac: 224000,
        ispSL:     311,
        ispVac:    343,
        dryMass:   950,
        propMass:  9250,
        separationTime: 155,
      },
      {
        name: 'Stage 2',
        thrustSL:  0,
        thrustVac: 25800,
        ispSL:     343,
        ispVac:    343,
        dryMass:   250,
        propMass:  2150,
        separationTime: 9999,
      },
    ],
  },
  {
    match: ['alpha'],
    name: 'Firefly Alpha',
    refArea: 3.14,         // m² (2m diameter)
    cdCurve: DEFAULT_CD,
    payloadMass: 800,
    defaultAzimuth: 180,   // Vandenberg — southward to SSO
    targetOrbitAlt: 500000,
    stages: [
      {
        name: 'Stage 1',
        thrustSL:  736000,
        thrustVac: 800000,
        ispSL:     295,
        ispVac:    322,
        dryMass:   3300,
        propMass:  44000,
        separationTime: 145,
      },
      {
        name: 'Stage 2',
        thrustSL:  0,
        thrustVac: 70100,
        ispSL:     322,
        ispVac:    322,
        dryMass:   900,
        propMass:  8600,
        separationTime: 9999,
      },
    ],
  },
  {
    match: ['vulcan'],
    name: 'Vulcan Centaur',
    refArea: 14.2,         // m² (5.4m diameter)
    cdCurve: DEFAULT_CD,
    payloadMass: 18000,
    defaultAzimuth: 40,
    targetOrbitAlt: 400000,
    stages: [
      {
        name: 'Stage 1',
        thrustSL:  4800000,
        thrustVac: 5400000,
        ispSL:     310,
        ispVac:    338,
        dryMass:   27000,
        propMass:  440000,
        separationTime: 248,
      },
      {
        name: 'Centaur V',
        thrustSL:  0,
        thrustVac: 212000,
        ispSL:     452,
        ispVac:    452,
        dryMass:   2700,
        propMass:  54000,
        separationTime: 9999,
      },
    ],
  },
  {
    match: ['new glenn'],
    name: 'New Glenn',
    refArea: 28.3,         // m² (7m diameter)
    cdCurve: DEFAULT_CD,
    payloadMass: 20000,
    defaultAzimuth: 38,
    targetOrbitAlt: 400000,
    stages: [
      {
        name: 'Stage 1',
        thrustSL:  17150000,
        thrustVac: 19000000,
        ispSL:     322,
        ispVac:    340,
        dryMass:   50000,
        propMass:  800000,
        separationTime: 180,
      },
      {
        name: 'Stage 2',
        thrustSL:  0,
        thrustVac: 1780000,
        ispSL:     450,
        ispVac:    450,
        dryMass:   7000,
        propMass:  130000,
        separationTime: 9999,
      },
    ],
  },
  {
    match: ['h3', 'h-3'],
    name: 'H3',
    refArea: 12.6,
    cdCurve: DEFAULT_CD,
    payloadMass: 6500,
    defaultAzimuth: 195,
    targetOrbitAlt: 500000,
    stages: [
      {
        name: 'Stage 1',
        thrustSL:  4000000,
        thrustVac: 4500000,
        ispSL:     340,
        ispVac:    374,
        dryMass:   20000,
        propMass:  150000,
        separationTime: 317,
      },
      {
        name: 'Stage 2',
        thrustSL:  0,
        thrustVac: 137000,
        ispSL:     448,
        ispVac:    448,
        dryMass:   3000,
        propMass:  16900,
        separationTime: 9999,
      },
    ],
  },
];

// Generic fallback for unknown vehicles
const GENERIC_CONFIG = {
  name: 'Generic Launch Vehicle',
  refArea: 10,
  cdCurve: DEFAULT_CD,
  payloadMass: 5000,
  defaultAzimuth: 90,
  targetOrbitAlt: 400000,
  stages: [
    {
      name: 'Stage 1',
      thrustSL:  5000000,
      thrustVac: 5500000,
      ispSL:     290,
      ispVac:    320,
      dryMass:   20000,
      propMass:  300000,
      separationTime: 160,
    },
    {
      name: 'Stage 2',
      thrustSL:  0,
      thrustVac: 900000,
      ispSL:     330,
      ispVac:    350,
      dryMass:   3000,
      propMass:  80000,
      separationTime: 9999,
    },
  ],
};

// Match vehicle name string to config (case-insensitive substring)
export function getRocketConfig(vehicleName) {
  if (!vehicleName) return GENERIC_CONFIG;
  const lower = vehicleName.toLowerCase();
  for (const config of ROCKETS) {
    if (config.match.some(m => lower.includes(m))) return config;
  }
  return GENERIC_CONFIG;  // always return something
}
```

**Step 2: Commit**

```bash
git add js/rockets.js
git commit -m "feat: add rocket configuration database for 8 vehicles + generic fallback"
```

---

### Task 5: Simulation Module

**Files:**
- Modify: `rocket-launch-map/js/simulation.js`
- Modify: `rocket-launch-map/tests/test.html`

**Step 1: Write the failing simulation tests**

Add to `tests/test.html`:

```javascript
import { runSimulation } from '../js/simulation.js';
import { getRocketConfig } from '../js/rockets.js';

QUnit.module('Simulation', () => {
  const capeLaunch = { lat: 28.6, lon: -80.6, azimuth: 53 };
  const t0 = '2026-03-02T02:43:00Z';

  QUnit.test('Electron produces at least 50 waypoints', assert => {
    const config = getRocketConfig('Electron');
    const wps = runSimulation(config, capeLaunch, t0);
    assert.ok(wps.length >= 50, `got ${wps.length} waypoints`);
  });

  QUnit.test('first waypoint is near launch site', assert => {
    const config = getRocketConfig('Electron');
    const wps = runSimulation(config, capeLaunch, t0);
    const first = wps[0];
    assert.close(first.lat, 28.6, 0.5, 'first lat near launch site');
    assert.close(first.lon, -80.6, 0.5, 'first lon near launch site');
  });

  QUnit.test('altitude increases early in flight', assert => {
    const config = getRocketConfig('Electron');
    const wps = runSimulation(config, capeLaunch, t0);
    const early = wps.slice(0, 10);
    for (let i = 1; i < early.length; i++) {
      assert.ok(early[i].alt_km >= early[i-1].alt_km - 5,
        `altitude non-decreasing at T+${early[i].t_plus_s}s`);
    }
  });

  QUnit.test('max altitude exceeds 100 km (past Karman line)', assert => {
    const config = getRocketConfig('Electron');
    const wps = runSimulation(config, capeLaunch, t0);
    const maxAlt = Math.max(...wps.map(w => w.alt_km));
    assert.ok(maxAlt > 100, `max alt = ${maxAlt.toFixed(0)} km`);
  });

  QUnit.test('each waypoint has required fields', assert => {
    const config = getRocketConfig('Falcon 9');
    const wps = runSimulation(config, capeLaunch, t0);
    const wp = wps[10];
    assert.ok('lat' in wp,           'has lat');
    assert.ok('lon' in wp,           'has lon');
    assert.ok('alt_km' in wp,        'has alt_km');
    assert.ok('velocity_ms' in wp,   'has velocity_ms');
    assert.ok('stage' in wp,         'has stage');
    assert.ok('t_plus_s' in wp,      'has t_plus_s');
    assert.ok('timestamp_utc' in wp, 'has timestamp_utc');
  });

  QUnit.test('stage number increments at staging event', assert => {
    const config = getRocketConfig('Falcon 9');
    const wps = runSimulation(config, capeLaunch, t0);
    const stages = [...new Set(wps.map(w => w.stage))].sort();
    assert.ok(stages.length >= 2, `has ${stages.length} stages`);
    assert.ok(stages.includes(1), 'has stage 1');
    assert.ok(stages.includes(2), 'has stage 2');
  });

  QUnit.test('timestamps advance monotonically', assert => {
    const config = getRocketConfig('Falcon 9');
    const wps = runSimulation(config, capeLaunch, t0);
    for (let i = 1; i < wps.length; i++) {
      assert.ok(
        wps[i].t_plus_s > wps[i-1].t_plus_s,
        `T+${wps[i].t_plus_s}s > T+${wps[i-1].t_plus_s}s`
      );
    }
  });
});
```

**Step 2: Verify tests FAIL**

Reload tests page. Expected: simulation tests fail.

**Step 3: Implement simulation.js**

```javascript
import { rk4Step } from './physics.js';

const R_EARTH = 6371000;  // m
const DEG     = Math.PI / 180;
const P0      = 101325;   // Pa sea-level pressure

// Convert Earth-centered polar (downrange angle, azimuth, origin) to geographic lat/lon
// downrangeAngle: arc angle from Earth center (radians)
// azimuth: launch heading degrees clockwise from north
function polarToGeo(lat0_deg, lon0_deg, azimuth_deg, downrangeAngle) {
  const lat0 = lat0_deg * DEG;
  const lon0 = lon0_deg * DEG;
  const az   = azimuth_deg * DEG;
  const d    = downrangeAngle;  // arc radians

  const sinLat = Math.sin(lat0) * Math.cos(d) + Math.cos(lat0) * Math.sin(d) * Math.cos(az);
  const lat    = Math.asin(Math.max(-1, Math.min(1, sinLat)));
  const lon    = lon0 + Math.atan2(
    Math.sin(az) * Math.sin(d) * Math.cos(lat0),
    Math.cos(d) - Math.sin(lat0) * Math.sin(lat)
  );

  return { lat: lat / DEG, lon: lon / DEG };
}

export function runSimulation(rocketConfig, launchSite, launchTimeISO) {
  const { lat, lon, azimuth } = launchSite;
  const { stages, refArea, cdCurve, payloadMass = 0, targetOrbitAlt = 400000 } = rocketConfig;

  // Initial total mass
  const totalMass = stages.reduce((s, st) => s + st.dryMass + st.propMass, 0) + payloadMass;

  // State: [r, v, gamma, theta, m]
  // Start at 1 m/s upward so derivatives are well-defined
  let state = [R_EARTH + (launchSite.alt_m || 10), 1.0, Math.PI / 2, 0, totalMass];

  let t        = 0;
  let stageIdx = 0;
  const waypoints = [];
  const MAX_T     = 700;  // seconds
  const WAYPOINT_INTERVAL = 5;  // record every 5 simulated seconds

  // Track mass remaining per stage for accurate separation
  let propConsumed = 0;

  while (t < MAX_T) {
    const [r, v, gamma] = state;
    const h = r - R_EARTH;

    // Check stage separation
    while (stageIdx < stages.length - 1 && t >= stages[stageIdx].separationTime) {
      const droppedMass = stages[stageIdx].dryMass;
      state[4] = Math.max(state[4] - droppedMass, 1);
      stageIdx++;
    }

    const currentStage = stages[Math.min(stageIdx, stages.length - 1)];

    // Remaining mass of stages below (dry + propellant) plus payload
    const remainingStructure = stages.slice(stageIdx).reduce((s, st) => s + st.dryMass, 0) + payloadMass;

    const engine = {
      active:    state[4] > remainingStructure + 100,  // propellant remains
      dryMass:   remainingStructure,
      thrustSL:  stageIdx === 0 ? currentStage.thrustSL : 0,  // vacuum stage
      thrustVac: currentStage.thrustVac,
      ispSL:     stageIdx === 0 ? currentStage.ispSL : currentStage.ispVac,
      ispVac:    currentStage.ispVac,
      refArea,
      cdCurve,
    };

    // Cut engine once target orbit altitude is reached at shallow angle
    if (h >= targetOrbitAlt && Math.abs(gamma) < 0.15) {
      engine.active = false;
    }

    // Guidance: pitch kick at T+10s from straight up to 85°
    if (t >= 10 && state[2] > 85 * DEG) {
      state[2] = 85 * DEG;
    }

    // Time step
    const dt = h < 120000 ? 0.5 : 2.0;
    state = rk4Step(state, dt, engine, P0);
    t += dt;

    // Record waypoint
    if (waypoints.length === 0 || (t - (waypoints.at(-1)?._t || 0)) >= WAYPOINT_INTERVAL) {
      const geo = polarToGeo(lat, lon, azimuth, state[3]);
      const altKm = (state[0] - R_EARTH) / 1000;
      const t0Ms = launchTimeISO ? new Date(launchTimeISO).getTime() : 0;

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

    // Abort if rocket goes underground or reaches stable orbit
    if (state[0] < R_EARTH - 5000) break;
    if (h > targetOrbitAlt + 50000) break;
  }

  // Strip internal _t field
  return waypoints.map(({ _t, ...wp }) => wp);
}
```

**Step 4: Verify simulation tests PASS**

Reload `http://localhost:8080/tests/test.html`.
Expected: all simulation tests pass. Note: timing-sensitive tests (altitude increases) may need slight tolerance — adjust delta if needed.

**Step 5: Commit**

```bash
git add js/simulation.js tests/test.html
git commit -m "feat: implement trajectory simulation with polar-to-geo coordinate conversion"
```

---

### Task 6: API Module

**Files:**
- Modify: `rocket-launch-map/js/api.js`

No unit tests for this module — it makes live network calls. Will be verified visually in Task 8.

**Step 1: Implement api.js**

```javascript
const API_BASE = 'https://fdo.rocketlaunch.live/json';
const API_KEY  = '__ROCKETLAUNCH_API_KEY__';

export async function fetchLaunches() {
  const res = await fetch(`${API_BASE}/launches/next/5?key=${API_KEY}`);
  if (!res.ok) throw new Error(`Launches API error ${res.status}`);
  const data = await res.json();
  return data.result || [];
}

// Fetch all pad pages and return a map of padId → { lat, lon, name }
export async function fetchPads() {
  const padMap = {};
  let page = 1;

  while (true) {
    const res = await fetch(`${API_BASE}/pads?key=${API_KEY}&page=${page}`);
    if (!res.ok) break;
    const data = await res.json();

    for (const pad of data.result || []) {
      const loc = pad.location;
      if (loc?.latitude && loc?.longitude) {
        padMap[pad.id] = {
          lat:  parseFloat(loc.latitude),
          lon:  parseFloat(loc.longitude),
          name: pad.full_name || pad.name,
        };
      }
    }

    if (page >= (data.last_page || 1)) break;
    page++;
  }

  return padMap;
}
```

**Step 2: Commit**

```bash
git add js/api.js
git commit -m "feat: add rocketlaunch.live API client (launches + pads)"
```

---

### Task 7: App — Map Init + Launch List

**Files:**
- Modify: `rocket-launch-map/js/app.js`

**Step 1: Implement app.js (map init + launch list rendering)**

```javascript
import { fetchLaunches, fetchPads }    from './api.js';
import { runSimulation }               from './simulation.js';
import { getRocketConfig }             from './rockets.js';

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

// ── Launch list ───────────────────────────────────────────────────────────────

function formatTime(isoStr) {
  if (!isoStr) return null;
  const d = new Date(isoStr);
  return d.toUTCString().replace(' GMT', ' UTC');
}

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

    card.innerHTML = `
      <div class="launch-name">${launch.name}</div>
      <div class="launch-vehicle">${launch.vehicle?.name ?? 'Unknown vehicle'} · ${launch.provider?.name ?? ''}</div>
      <div class="launch-site">📍 ${launch.pad?.location?.name ?? 'Unknown site'}</div>
      <div class="launch-time">${t0Str ?? launch.date_str ?? 'Date TBD'}</div>
      ${launch.weather_condition ? `<div class="launch-weather">${launch.weather_condition} · ${launch.weather_temp}°F · Wind ${launch.weather_wind_mph} mph</div>` : ''}
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

  // Group waypoints by stage to draw colored polylines
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
  L.marker([pad.lat, pad.lon], { icon: rocketIcon })
    .bindPopup(`<b>${launch.name}</b><br>${pad.name}<br>T-0: ${launch.t0 ?? launch.win_open ?? 'TBD'}`)
    .addTo(trajectoryLayer)
    .openPopup();

  // Milestone markers every ~60 seconds
  const milestones = waypoints.filter((wp, i) => {
    if (i === 0 || i === waypoints.length - 1) return true;
    return wp.t_plus_s % 60 < 5;
  });

  for (const wp of milestones) {
    const mins = Math.floor(wp.t_plus_s / 60);
    const secs = String(wp.t_plus_s % 60).padStart(2, '0');
    const color = STAGE_COLORS[wp.stage] || '#94a3b8';

    L.circleMarker([wp.lat, wp.lon], {
      radius:      5,
      color:       color,
      fillColor:   color,
      fillOpacity: 1,
      weight:      1.5,
    }).bindPopup(`
      <b>T+${mins}m ${secs}s</b><br>
      Alt: <b>${wp.alt_km} km</b><br>
      Speed: <b>${(wp.velocity_ms / 1000).toFixed(2)} km/s</b><br>
      Stage: ${wp.stage}<br>
      <small>${wp.timestamp_utc ?? ''}</small>
    `).addTo(trajectoryLayer);
  }

  // Fit map to trajectory
  const bounds = L.latLngBounds(waypoints.map(wp => [wp.lat, wp.lon]));
  map.fitBounds(bounds, { padding: [40, 40] });
}

// ── Event handling ────────────────────────────────────────────────────────────

async function handleLaunchClick(launch, pad, config, card) {
  // Update selected state
  document.querySelectorAll('.launch-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  trajectoryLayer.clearLayers();

  if (!pad) {
    trajectoryLayer.clearLayers();
    L.popup({ closeButton: false })
      .setLatLng(map.getCenter())
      .setContent('⚠️ Launch site coordinates not available for this pad.')
      .openOn(map);
    return;
  }

  document.getElementById('map-loading').style.display = 'flex';

  // Yield to browser so spinner renders before synchronous simulation
  await new Promise(r => setTimeout(r, 20));

  try {
    const launchTime = launch.t0 || launch.win_open;

    // Determine launch azimuth from config, adjusting for known southern launches
    let azimuth = config.defaultAzimuth;
    if (pad.lat < 0) azimuth = 180; // launches from southern hemisphere often go south

    const waypoints = runSimulation(config, { lat: pad.lat, lon: pad.lon, azimuth }, launchTime);
    renderTrajectory(waypoints, launch, pad);
  } catch (err) {
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

  try {
    const [launches, pads] = await Promise.all([fetchLaunches(), fetchPads()]);
    renderLaunchList(launches, pads);
  } catch (err) {
    document.getElementById('launch-list').innerHTML =
      `<p class="error">⚠️ Could not load launches:<br>${err.message}</p>`;
  }
}

init();
```

**Step 2: Verify in browser**

Open `http://localhost:8080`.
Expected:
- Dark sidebar shows 5 upcoming launch cards with names, vehicles, sites, times
- Clicking a card shows a loading spinner, then draws an orange (stage 1) → blue (stage 2) trajectory polyline on the map
- Milestone markers appear; clicking one shows T+, altitude, speed, timestamp popup
- Map auto-fits to the trajectory

**Step 3: Commit**

```bash
git add js/app.js
git commit -m "feat: wire up map, launch list, trajectory rendering, and milestone markers"
```

---

### Task 8: CSS Polish + Error States

**Files:**
- Modify: `rocket-launch-map/css/style.css`

**Step 1: Add weather display + missing utility styles**

Append to `css/style.css`:

```css
.launch-weather {
  font-size: 0.7rem;
  color: #64748b;
  margin-top: 2px;
}

/* Legend */
#legend {
  position: absolute;
  bottom: 24px;
  right: 10px;
  z-index: 1000;
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 0.72rem;
  color: #94a3b8;
  pointer-events: none;
}

#legend .leg-item {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

#legend .leg-item:last-child { margin-bottom: 0; }

.leg-swatch {
  width: 20px;
  height: 3px;
  border-radius: 2px;
}
```

**Step 2: Add a legend to index.html**

In `index.html`, add before the closing `</body>`:

```html
<div id="legend">
  <div class="leg-item"><div class="leg-swatch" style="background:#f97316"></div> Stage 1</div>
  <div class="leg-item"><div class="leg-swatch" style="background:#3b82f6"></div> Stage 2</div>
  <div class="leg-item"><div class="leg-swatch" style="background:#a855f7"></div> Stage 3+</div>
</div>
```

**Step 3: Verify final appearance in browser**

Open `http://localhost:8080`.
Expected:
- Stage legend appears in bottom-right corner of map
- Launch cards look polished: name, orange vehicle label, site, time, weather
- Selected card has orange border
- Spinner appears while simulating

**Step 4: Final commit**

```bash
git add index.html css/style.css
git commit -m "feat: add stage legend, weather display, and final CSS polish"
```

---

### Task 9: End-to-End Verification

**Step 1: Run all tests**

Open `http://localhost:8080/tests/test.html`.
Expected: all tests pass (atmosphere, physics, simulation). Minimum 15 tests total.

**Step 2: Click through all launches**

Click each card in the sidebar. For each:
- [ ] Trajectory polyline appears on the map
- [ ] Stage 1 leg is orange, stage 2 is blue
- [ ] Milestone markers are present along the path
- [ ] Clicking a marker shows T+, altitude, speed, timestamp
- [ ] Map auto-fits to trajectory bounds
- [ ] Loading spinner shows and hides correctly

**Step 3: Verify trajectory realism**

For Falcon 9: trajectory should arc eastward from Florida, reaching 400–600 km altitude, with a max speed around 7,800 m/s. Stage separation marker should appear ~T+2m 40s.

For Electron: trajectory should head southward from New Zealand or Virginia, reaching 500 km, with smaller arc than Falcon 9.

**Step 4: Final commit**

```bash
git add .
git commit -m "chore: end-to-end verification complete, all tests passing"
```

---

## Running Locally

```bash
cd "/Users/mikesteward/Claude Projects/rocket-launch-map"
python3 -m http.server 8080
# Open http://localhost:8080
# Tests: http://localhost:8080/tests/test.html
```

## Hosting

Drop the `rocket-launch-map/` folder onto GitHub Pages, Netlify, or Vercel. No build step, no environment variables. The API key is embedded in `js/api.js`.
