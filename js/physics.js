import { getAtmosphere } from './atmosphere.js';

const GM      = 3.986004418e14;  // m³/s²  Earth gravitational parameter
const R_EARTH = 6371000;         // m       mean Earth radius
const G0      = 9.80665;         // m/s²   standard gravity (for Isp → mass-flow)

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
// state  = [r, v, gamma, theta, m]
//   r      — distance from Earth centre (m)
//   v      — speed (m/s)
//   gamma  — flight path angle from local horizontal (rad); 90° = straight up
//   theta  — downrange angle (rad)
//   m      — vehicle mass (kg)
// engine = { active, dryMass, thrustSL, thrustVac, ispSL, ispVac, refArea, cdCurve }
// p0     — sea-level pressure (Pa), used to interpolate thrust/Isp
export function derivatives(state, engine, p0) {
  const [r, v, gamma, , m] = state;
  const h = r - R_EARTH;

  const atmos = getAtmosphere(Math.max(0, h));
  const g     = GM / (r * r);

  // ── Thrust & mass flow ────────────────────────────────────────────────────
  let thrust = 0;
  let mdot   = 0;
  if (engine && engine.active && m > (engine.dryMass || 0)) {
    const pRatio = p0 > 0 ? atmos.pressure_pa / p0 : 0;
    thrust = engine.thrustVac + (engine.thrustSL - engine.thrustVac) * pRatio;
    const isp = engine.ispVac + (engine.ispSL - engine.ispVac) * pRatio;
    mdot = thrust / (isp * G0);
  }

  // ── Aerodynamic drag ──────────────────────────────────────────────────────
  const safeV   = Math.max(v, 0.01);
  const mach    = safeV / Math.max(atmos.speed_of_sound_ms, 1);
  const cdCurve = engine?.cdCurve || [[0, 0.3], [1, 0.5], [3, 0.3], [8, 0.2]];
  const cd      = interpolateCd(mach, cdCurve);
  const area    = engine?.refArea || 10;
  const drag    = 0.5 * atmos.density_kgm3 * v * v * area * cd;

  // ── Equations of motion (polar 3DOF) ─────────────────────────────────────
  const dr     = v * Math.sin(gamma);
  const dv     = (thrust - drag) / m - g * Math.sin(gamma);
  const dgamma = (v / r - g / Math.max(v, 0.01)) * Math.cos(gamma);
  const dtheta = v * Math.cos(gamma) / r;
  const dm     = -mdot;

  return [dr, dv, dgamma, dtheta, dm];
}

// 4th-order Runge-Kutta single step
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
