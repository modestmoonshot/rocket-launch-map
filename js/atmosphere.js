// US Standard Atmosphere 1976
// Ref: COESA 1976, ISO 2533:1975

const R_AIR = 287.058;   // J/(kg·K) specific gas constant for dry air
const GAMMA = 1.4;       // ratio of specific heats
const G0    = 9.80665;   // m/s² standard gravity

// Layer table: [base_alt_m, base_temp_K, lapse_rate_K/m, base_pressure_Pa]
const LAYERS = [
  [    0, 288.15, -0.0065, 101325.0 ],
  [11000, 216.65,  0.0,    22632.1  ],
  [20000, 216.65,  0.001,  5474.89  ],
  [32000, 228.65,  0.0028,  868.019 ],
  [47000, 270.65,  0.0,     110.906 ],
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
  const a   = Math.sqrt(GAMMA * R_AIR * T);  // speed of sound

  return {
    pressure_pa:       p,
    density_kgm3:      rho,
    temperature_k:     T,
    speed_of_sound_ms: a,
  };
}
