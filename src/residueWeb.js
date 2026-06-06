const GRID = 250;

function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
}

function mod(n, m) {
  return ((n % m) + m) % m;
}

function residueDistance(a, b, modulus) {
  const d = Math.abs(a - b);
  return Math.min(d, modulus - d);
}

function hash01(n) {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function nodeIndex(u, v) {
  return mod(u, GRID) * GRID + mod(v, GRID);
}

export function buildResidueWeb(params) {
  const {
    modulus,
    residueWindow,
    phase,
    tension,
    threadDensity,
    veilWeight,
    dewCurrent,
    strandCount,
  } = params;

  const nodeCount = GRID * GRID;
  const positions = new Float32Array(nodeCount * 3);
  const residues = new Uint8Array(nodeCount);
  const degrees = new Uint16Array(nodeCount);

  const phaseRad = phase * 0.017453292519943295;
  const drift = phase * 0.004;

  for (let u = 0; u < GRID; u++) {
    for (let v = 0; v < GRID; v++) {
      const idx = u * GRID + v;
      const residue = mod(u * 3 + v * 5 + phase, modulus);
      residues[idx] = residue;

      const fu = u / GRID;
      const fv = v / GRID;
      const theta = fu * Math.PI * 2 + drift;
      const phi = fv * Math.PI;

      const residueWave =
        Math.sin((residue / modulus) * Math.PI * 2 + phaseRad) * tension * 2.2;
      const weave =
        0.1 * Math.sin(theta * 5 + phi * 3 + drift) +
        0.08 * Math.cos(theta * 2 - phi * 4 + phaseRad);

      const radius = 2.15 + residueWave + weave;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);
      const depthJitter =
        0.22 * Math.sin(u * 0.19 + v * 0.11 + phaseRad) * Math.cos(v * 0.07 - drift);

      const noise =
        (hash01(idx * 1.7 + phase) - 0.5) * 0.28 +
        (hash01(idx * 2.3 - phase) - 0.5) * 0.18;

      positions[idx * 3] =
        radius * sinPhi * Math.cos(theta) + depthJitter * Math.cos(theta) + noise * sinPhi;
      positions[idx * 3 + 1] =
        radius * sinPhi * Math.sin(theta) + depthJitter * Math.sin(theta) + noise * cosPhi;
      positions[idx * 3 + 2] =
        radius * Math.cos(phi) * 0.78 + depthJitter * 0.6 + noise * 0.35;
    }
  }

  const linePositions = [];
  const pushLine = (a, b) => {
    linePositions.push(
      positions[a * 3],
      positions[a * 3 + 1],
      positions[a * 3 + 2],
      positions[b * 3],
      positions[b * 3 + 1],
      positions[b * 3 + 2],
    );
    degrees[a]++;
    degrees[b]++;
  };

  const localOffsets = [
    [1, 0],
    [0, 1],
    [2, 3],
    [3, 5],
    [5, 8],
  ];

  for (let u = 0; u < GRID; u++) {
    for (let v = 0; v < GRID; v++) {
      const a = nodeIndex(u, v);
      for (const [du, dv] of localOffsets) {
        const b = nodeIndex(u + du, v + dv);
        if (residueDistance(residues[a], residues[b], modulus) <= residueWindow) {
          pushLine(a, b);
        }
      }
    }
  }

  const coprimeMultipliers = [];
  for (let m = 2; m < modulus; m++) {
    if (gcd(m, modulus) === 1) coprimeMultipliers.push(m);
  }

  const steps = Math.floor(GRID * threadDensity * 0.62);
  for (let s = 0; s < strandCount; s++) {
    const mult = coprimeMultipliers[s % coprimeMultipliers.length];
    const band = Math.floor(s / coprimeMultipliers.length);
    let u = mod(s * 17 + band * 3 + mod(phase, modulus), GRID);
    let v = mod(s * 29 + band * 7 + mod(phase >> 1, modulus), GRID);

    for (let step = 0; step < steps; step++) {
      const a = nodeIndex(u, v);
      u = mod(u * mult + band + mod(phase, modulus), GRID);
      v = mod(v + mult + mod(phase >> 2, modulus), GRID);
      const b = nodeIndex(u, v);

      if (residueDistance(residues[a], residues[b], modulus) <= residueWindow + 1) {
        pushLine(a, b);
      }
    }
  }

  const veilPositions = [];
  if (veilWeight > 0.01) {
    const stride = 8;
    for (let u = 0; u < GRID; u += stride) {
      for (let v = 0; v < GRID; v += stride) {
        const a = nodeIndex(u, v);
        const b = nodeIndex(u + stride, v + stride);
        if (residueDistance(residues[a], residues[b], modulus) <= residueWindow + 2) {
          veilPositions.push(
            positions[a * 3],
            positions[a * 3 + 1],
            positions[a * 3 + 2],
            positions[b * 3],
            positions[b * 3 + 1],
            positions[b * 3 + 2],
          );
        }
      }
    }
  }

  const dewCandidates = [];
  for (let i = 0; i < nodeCount; i++) {
    if (degrees[i] < 3) continue;
    const score = degrees[i] * (0.35 + hash01(i + phase * 3));
    dewCandidates.push({ i, score });
  }

  dewCandidates.sort((a, b) => b.score - a.score);
  const targetDew = Math.floor(280 + dewCurrent * 80);
  const dewPositions = [];

  for (let d = 0; d < Math.min(targetDew, dewCandidates.length); d++) {
    const i = dewCandidates[d].i;
    dewPositions.push(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
  }

  return {
    nodeCount,
    linePositions: new Float32Array(linePositions),
    veilPositions: new Float32Array(veilPositions),
    nodePositions: positions,
    dewPositions: new Float32Array(dewPositions),
    strandCount,
    dewCount: dewPositions.length / 3,
  };
}

export function formatNodeCount(count) {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k nodes`;
  }
  return `${count} nodes`;
}
