const GRID = 250;
const MAX_LINE_FLOATS = 1200000; // ~200k segments cap

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

function pickTopDew(degrees, nodeCount, phase, dewCurrent) {
  const target = Math.floor(280 + dewCurrent * 80);
  const topScore = new Float32Array(target);
  const topIndex = new Uint32Array(target);
  let count = 0;

  for (let i = 0; i < nodeCount; i++) {
    if (degrees[i] < 3) continue;
    const score = degrees[i] * (0.35 + hash01(i + phase * 3));

    if (count < target) {
      topScore[count] = score;
      topIndex[count] = i;
      count++;
      continue;
    }

    let minIdx = 0;
    for (let j = 1; j < target; j++) {
      if (topScore[j] < topScore[minIdx]) minIdx = j;
    }
    if (score > topScore[minIdx]) {
      topScore[minIdx] = score;
      topIndex[minIdx] = i;
    }
  }

  return { topIndex, count: Math.min(count, target) };
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

  const lineBuffer = new Float32Array(MAX_LINE_FLOATS);
  let lineWrite = 0;

  const pushLine = (a, b) => {
    if (lineWrite + 6 > lineBuffer.length) return;
    const pa = a * 3;
    const pb = b * 3;
    lineBuffer[lineWrite++] = positions[pa];
    lineBuffer[lineWrite++] = positions[pa + 1];
    lineBuffer[lineWrite++] = positions[pa + 2];
    lineBuffer[lineWrite++] = positions[pb];
    lineBuffer[lineWrite++] = positions[pb + 1];
    lineBuffer[lineWrite++] = positions[pb + 2];
    degrees[a]++;
    degrees[b]++;
  };

  const localOffsets = [
    [1, 0],
    [0, 1],
    [2, 3],
    [3, 5],
  ];

  for (let u = 0; u < GRID; u += 2) {
    for (let v = 0; v < GRID; v += 2) {
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

  const steps = Math.floor(GRID * threadDensity * 0.38);
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

  const linePositions = lineBuffer.subarray(0, lineWrite);

  const veilPositions = [];
  if (veilWeight > 0.01) {
    const stride = 10;
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

  const { topIndex, count: dewCount } = pickTopDew(degrees, nodeCount, phase, dewCurrent);
  const dewPositions = new Float32Array(dewCount * 3);
  for (let d = 0; d < dewCount; d++) {
    const i = topIndex[d];
    dewPositions[d * 3] = positions[i * 3];
    dewPositions[d * 3 + 1] = positions[i * 3 + 1];
    dewPositions[d * 3 + 2] = positions[i * 3 + 2];
  }

  return {
    nodeCount,
    linePositions,
    lineSegmentCount: Math.floor(lineWrite / 6),
    veilPositions: new Float32Array(veilPositions),
    dewPositions,
    strandCount,
    dewCount,
  };
}

export function formatNodeCount(count) {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k nodes`;
  }
  return `${count} nodes`;
}
