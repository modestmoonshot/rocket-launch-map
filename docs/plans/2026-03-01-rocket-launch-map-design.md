# Rocket Launch Map — Design Document
**Date:** 2026-03-01
**Status:** Approved

---

## Overview

A pure static website that fetches upcoming rocket launches from the rocketlaunch.live API, simulates each launch trajectory using a 3DOF physics engine, and plots the flight path as interactive waypoints on a Leaflet.js map. No backend, no build tools — deployable by dropping a folder on any static host.

---

## Architecture

### File Structure

```
rocket-launch-map/
  index.html          ← shell, CDN imports (Leaflet.js)
  css/
    style.css         ← two-panel layout, sidebar, map
  js/
    atmosphere.js     ← US Standard Atmosphere 1976 (7-layer model)
    physics.js        ← RK4 integrator + force equations
    rockets.js        ← rocket configuration database
    simulation.js     ← simulation runner, polar → lat/lon conversion
    api.js            ← rocketlaunch.live API + pad coordinate lookup
    app.js            ← UI, launch list, map rendering, event wiring
```

### Dependencies (CDN only)

- **Leaflet.js** — interactive map rendering
- **OpenStreetMap** — free map tile layer

---

## Physics Engine

### Model Type

3DOF point-mass simulation in polar coordinates. Matches the approach used by FlightClub.io (inferred from public technical statements).

### State Vector

`(r, v, γ, θ, m)` at each timestep:
- `r` — radial distance from Earth center (m)
- `v` — speed magnitude (m/s)
- `γ` (gamma) — flight path angle from local horizontal (rad)
- `θ` (theta) — downrange angle from launch site (rad)
- `m` — vehicle mass (kg)

### Force Model

**Gravity** (inverse-square):
```
g(r) = GM_earth / r²
GM_earth = 3.986004418 × 10¹⁴ m³/s²
```

**Atmosphere — US Standard Atmosphere 1976 (7 layers, 0–86 km):**
```
Layer 0 (0–11 km):   T = 288.15 − 6.5·h_km,   isothermal below 11 km
Layer 1 (11–20 km):  T = 216.65 (isothermal)
Layer 2 (20–32 km):  T = 216.65 + 1.0·(h−20)/1000
Layer 3 (32–47 km):  T = 228.65 + 2.8·(h−32)/1000
Layer 4 (47–51 km):  T = 270.65 (isothermal)
Layer 5 (51–71 km):  T = 270.65 − 2.8·(h−51)/1000
Layer 6 (71–86 km):  T = 214.65 − 2.0·(h−71)/1000
Above 86 km: ρ → 0 (effectively vacuum)
ρ = p / (R_air · T),  R_air = 287.058 J/(kg·K)
```

**Drag:**
```
F_drag = 0.5 · ρ(h) · v² · A_ref · Cd(Mach)
Mach = v / speed_of_sound(T)
```
Cd(Mach) is a piecewise curve per vehicle config (subsonic ~0.3, transonic peak ~0.5, supersonic ~0.3, hypersonic ~0.2).

**Thrust (pressure-corrected):**
```
F_thrust(h) = F_vac + (F_sl − F_vac) · p(h)/p₀
Isp(h)      = Isp_vac + (Isp_sl − Isp_vac) · p(h)/p₀
ṁ           = F_thrust / (Isp · g₀)
```

**Mass flow:**
```
dm/dt = −F_thrust / (Isp(h) · g₀)
```

### Equations of Motion (polar)

```
dr/dt     = v · sin(γ)
dv/dt     = (F_thrust − F_drag)/m − g(r)·sin(γ)
dγ/dt     = [v/r − g(r)/v] · cos(γ)       ← gravity turn (free-flight)
dθ/dt     = v · cos(γ) / r
dm/dt     = −ṁ
```

### Integration

4th-order Runge-Kutta (RK4):
- Timestep `dt = 0.5s` during atmospheric flight (h < 120 km)
- Timestep `dt = 2.0s` in vacuum
- Stage separation triggered at programmed T+ time: mass resets, engine config switches

### Guidance Program (per vehicle)

1. **Vertical ascent:** 0–10s, γ = 90°
2. **Pitch kick:** T+10s, γ steps to 85°
3. **Gravity turn:** vehicle follows velocity vector (free-flight, zero AoA) through max-Q
4. **Stage separation:** at programmed T+ per config
5. **Second stage burn:** continues gravity turn until target apogee altitude reached
6. **MECO:** engine cutoff, coast to apogee

### Output

Array of waypoints, one per ~5s of flight:
```json
{
  "t_plus_s": 120,
  "timestamp_utc": "2026-03-02T02:45:00Z",
  "lat": 34.752,
  "lon": -120.521,
  "alt_km": 87.4,
  "velocity_ms": 2340,
  "stage": 1
}
```

Conversion from polar (r, θ) to geographic (lat, lon) uses spherical Earth equations with the launch site as origin point and the launch azimuth as the heading.

---

## Rocket Configuration Database

Stored in `js/rockets.js`. Matched to launches by vehicle name string from the rocketlaunch.live API.

| Vehicle | Provider | Stages | S1 Thrust SL (kN) | S1 Isp SL (s) | S1 Prop Mass (kg) |
|---|---|---|---|---|---|
| Falcon 9 Block 5 | SpaceX | 2 | 7,607 | 282 | 409,500 |
| Falcon Heavy | SpaceX | 2+cores | 22,821 | 282 | 1,228,500 |
| Starship | SpaceX | 2 | 74,000 | 330 | ~3,600,000 |
| Electron | Rocket Lab | 2 | 190 | 311 | 9,250 |
| Firefly Alpha | Firefly | 2 | 736 | 295 | ~44,000 |
| Vulcan Centaur | ULA | 2 | 4,800 | 310 | ~440,000 |
| New Glenn | Blue Origin | 2 | 17,150 | 322 | ~800,000 |
| Generic | Fallback | 2 | 5,000 | 290 | 300,000 |

Each config also contains: dry masses, vacuum thrust/Isp, reference area, Cd curve breakpoints, staging T+ time, target orbit altitude, launch azimuth (derived from mission inclination where known).

---

## API Integration

**Endpoint:** `https://fdo.rocketlaunch.live/json/launches/next/5?key=<API_KEY>`
**Auth:** Query parameter `?key=`
**Pad coordinates:** `https://fdo.rocketlaunch.live/json/pads?key=<API_KEY>` — paginated, fetched once and cached in memory. Pads contain `location.latitude` / `location.longitude`.

**Data flow:**
1. On page load, fetch launches + all pad pages concurrently
2. Join launches → pad coordinates by `pad.id`
3. Render launch list
4. On launch click: look up vehicle config → run simulation → render trajectory

---

## UI / UX

### Layout

Two-panel side-by-side:
- **Left panel (25%):** Launch list sidebar
- **Right panel (75%):** Full-height Leaflet map

### Launch List

Each card displays:
- Mission name (bold)
- Vehicle name + provider
- Launch site name + country
- T-0 time: local timezone + UTC
- Weather icon + condition (from API)
- Visual state: default / selected / simulation-unavailable

### Map

- Leaflet.js + OpenStreetMap tiles
- On trajectory load, map fits bounds to trajectory extent
- **Launch site pin:** custom rocket icon, popup with pad name + coordinates
- **Trajectory polyline:** Stage 1 = orange, Stage 2 = blue
- **Milestone markers:** every 60s of flight (small circle), popup on click:
  ```
  T+2m 00s
  Altitude: 87.4 km
  Speed: 2,340 m/s
  Stage: 1
  ```
- **MECO marker:** star icon at engine cutoff, popup with orbital parameters (apogee/perigee estimate)
- **Loading state:** spinner overlay on map while simulation runs

### Error States

- Vehicle not in database → card shows "Trajectory simulation unavailable for this vehicle"
- Pad has no coordinates → "Launch site coordinates not available"
- API failure → "Could not load launches — check API key or network"

---

## Deployment

Local: open `index.html` directly, or `python3 -m http.server 8080` in the project directory.
Hosted: drop folder contents onto GitHub Pages, Netlify, Vercel, or any static host. No environment variables or server config needed (API key is embedded in `api.js`).
