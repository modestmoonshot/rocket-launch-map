// Rocket configuration database
// Matched to rocketlaunch.live vehicle names (case-insensitive substring match)
// Sources: Wikipedia, NASA SMA data sheets, manufacturer specs

// Default Cd curve: generic orbital launch vehicle shape
const DEFAULT_CD = [[0, 0.30], [0.8, 0.35], [1.0, 0.50], [1.5, 0.40], [3.0, 0.30], [6.0, 0.22], [10.0, 0.18]];

const ROCKETS = [
  {
    match: ['falcon 9'],
    name: 'Falcon 9 Block 5',
    refArea: 10.75,          // m²  (3.7 m diameter)
    cdCurve: DEFAULT_CD,
    payloadMass: 10000,      // kg  representative LEO payload
    defaultAzimuth: 53,      // °   mid-inclination (Starlink typical from KSC)
    targetOrbitAlt: 550000,  // m   550 km Starlink shell
    stages: [
      {
        name: 'Stage 1',
        thrustSL:       7607000,  // N   9× Merlin 1D SL
        thrustVac:      8227000,  // N   9× Merlin 1D vacuum
        ispSL:          282,      // s
        ispVac:         311,      // s
        dryMass:        22200,    // kg
        propMass:       409500,   // kg  LOX/RP-1
        separationTime: 162,      // s T+ (MECO-1 ≈ T+2:42)
      },
      {
        name: 'Stage 2',
        thrustSL:       0,
        thrustVac:      981000,   // N   1× Merlin Vacuum
        ispSL:          311,
        ispVac:         348,
        dryMass:        4000,
        propMass:       111500,
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
        thrustSL:       22819000,
        thrustVac:      24681000,
        ispSL:          282,
        ispVac:         311,
        dryMass:        66600,
        propMass:       1228500,
        separationTime: 162,
      },
      {
        name: 'Stage 2',
        thrustSL:       0,
        thrustVac:      981000,
        ispSL:          311,
        ispVac:         348,
        dryMass:        4000,
        propMass:       111500,
        separationTime: 9999,
      },
    ],
  },
  {
    match: ['starship'],
    name: 'Starship / Super Heavy',
    refArea: 78.5,            // m²  (10 m diameter)
    cdCurve: [[0, 0.35], [0.8, 0.45], [1.0, 0.60], [1.5, 0.45], [3.0, 0.35], [6.0, 0.28]],
    payloadMass: 100000,
    defaultAzimuth: 90,
    targetOrbitAlt: 250000,
    stages: [
      {
        name: 'Super Heavy',
        thrustSL:       74000000,  // N  33× Raptor 2 approx
        thrustVac:      82000000,
        ispSL:          327,
        ispVac:         363,
        dryMass:        200000,
        propMass:       3400000,
        separationTime: 170,
      },
      {
        name: 'Starship (Ship)',
        thrustSL:       0,
        thrustVac:      13000000,  // N  6× Raptor Vacuum
        ispSL:          350,
        ispVac:         380,
        dryMass:        100000,
        propMass:       1200000,
        separationTime: 9999,
      },
    ],
  },
  {
    match: ['electron'],
    name: 'Electron',
    refArea: 0.95,            // m²  (1.2 m diameter)
    cdCurve: DEFAULT_CD,
    payloadMass: 200,
    defaultAzimuth: 180,      // °   Māhia, NZ → southward to SSO
    targetOrbitAlt: 500000,
    stages: [
      {
        name: 'Stage 1',
        thrustSL:       190000,
        thrustVac:      224000,
        ispSL:          311,
        ispVac:         343,
        dryMass:        950,
        propMass:       9250,
        separationTime: 155,
      },
      {
        name: 'Stage 2',
        thrustSL:       0,
        thrustVac:      25800,
        ispSL:          343,
        ispVac:         343,
        dryMass:        250,
        propMass:       2150,
        separationTime: 9999,
      },
    ],
  },
  {
    match: ['alpha'],
    name: 'Firefly Alpha',
    refArea: 3.14,            // m²  (2 m diameter)
    cdCurve: DEFAULT_CD,
    payloadMass: 800,
    defaultAzimuth: 180,      // °   Vandenberg → southward to SSO
    targetOrbitAlt: 500000,
    stages: [
      {
        name: 'Stage 1',
        thrustSL:       736000,
        thrustVac:      800000,
        ispSL:          295,
        ispVac:         322,
        dryMass:        3300,
        propMass:       44000,
        separationTime: 145,
      },
      {
        name: 'Stage 2',
        thrustSL:       0,
        thrustVac:      70100,
        ispSL:          322,
        ispVac:         322,
        dryMass:        900,
        propMass:       8600,
        separationTime: 9999,
      },
    ],
  },
  {
    match: ['vulcan'],
    name: 'Vulcan Centaur',
    refArea: 14.2,            // m²  (5.4 m diameter)
    cdCurve: DEFAULT_CD,
    payloadMass: 18000,
    defaultAzimuth: 40,
    targetOrbitAlt: 400000,
    stages: [
      {
        name: 'Stage 1 (2× BE-4 + 2× GEM 63XL SRB)',
        thrustSL:       8280000,  // N  core 4800 kN + 2× SRB 1740 kN each
        thrustVac:      8900000,
        ispSL:          320,      // combined effective Isp
        ispVac:         345,
        dryMass:        27000,
        propMass:       516000,   // core RP-1/LOX + SRB solid prop
        separationTime: 248,
      },
      {
        name: 'Centaur V',
        thrustSL:       0,
        thrustVac:      212000,
        ispSL:          452,
        ispVac:         452,
        dryMass:        2700,
        propMass:       54000,
        separationTime: 9999,
      },
    ],
  },
  {
    match: ['new glenn'],
    name: 'New Glenn',
    refArea: 28.3,            // m²  (7 m diameter)
    cdCurve: DEFAULT_CD,
    payloadMass: 20000,
    defaultAzimuth: 38,
    targetOrbitAlt: 400000,
    stages: [
      {
        name: 'Stage 1',
        thrustSL:       17150000,
        thrustVac:      19000000,
        ispSL:          322,
        ispVac:         340,
        dryMass:        50000,
        propMass:       800000,
        separationTime: 180,
      },
      {
        name: 'Stage 2',
        thrustSL:       0,
        thrustVac:      1780000,
        ispSL:          450,
        ispVac:         450,
        dryMass:        7000,
        propMass:       130000,
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
    defaultAzimuth: 195,      // °   Tanegashima → southward to SSO
    targetOrbitAlt: 500000,
    stages: [
      {
        name: 'Stage 1',
        thrustSL:       4000000,
        thrustVac:      4500000,
        ispSL:          340,
        ispVac:         374,
        dryMass:        20000,
        propMass:       150000,
        separationTime: 317,
      },
      {
        name: 'Stage 2',
        thrustSL:       0,
        thrustVac:      137000,
        ispSL:          448,
        ispVac:         448,
        dryMass:        3000,
        propMass:       16900,
        separationTime: 9999,
      },
    ],
  },
  {
    match: ['soyuz'],
    name: 'Soyuz',
    refArea: 7.07,            // m²  (3 m diameter)
    cdCurve: DEFAULT_CD,
    payloadMass: 7000,
    defaultAzimuth: 51.6,
    targetOrbitAlt: 400000,
    stages: [
      {
        name: 'Stage 1+2 (parallel)',
        thrustSL:       7680000,
        thrustVac:      8960000,
        ispSL:          257,
        ispVac:         315,
        dryMass:        25000,
        propMass:       250000,
        separationTime: 118,
      },
      {
        name: 'Stage 3',
        thrustSL:       0,
        thrustVac:      298000,
        ispSL:          326,
        ispVac:         326,
        dryMass:        2355,
        propMass:       22300,
        separationTime: 9999,
      },
    ],
  },
  {
    match: ['ariane 6', 'ariane6'],
    name: 'Ariane 6',
    refArea: 19.6,            // m²  (5 m diameter)
    cdCurve: DEFAULT_CD,
    payloadMass: 11500,
    defaultAzimuth: 90,
    targetOrbitAlt: 400000,
    stages: [
      {
        name: 'Stage 1 (P120C + Vulcain 2.1)',
        thrustSL:       4580000,
        thrustVac:      5000000,
        ispSL:          320,
        ispVac:         434,
        dryMass:        15000,
        propMass:       175000,
        separationTime: 480,
      },
      {
        name: 'Stage 2 (ICESFAR)',
        thrustSL:       0,
        thrustVac:      180000,
        ispSL:          462,
        ispVac:         462,
        dryMass:        2000,
        propMass:       31000,
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
      thrustSL:       5000000,
      thrustVac:      5500000,
      ispSL:          290,
      ispVac:         320,
      dryMass:        20000,
      propMass:       300000,
      separationTime: 160,
    },
    {
      name: 'Stage 2',
      thrustSL:       0,
      thrustVac:      900000,
      ispSL:          330,
      ispVac:         350,
      dryMass:        3000,
      propMass:       80000,
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
  return GENERIC_CONFIG;  // always return a usable config
}
