import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { computePCA } from './pca.js';

// Update this URL whenever the marker design changes
export const MARKER_URL =
  'https://raw.githubusercontent.com/michaelposcente-creator/Limb_Align/main/public/Marker.STL';

let _cachedMarkerGeo = null;

/**
 * Fetch and parse the marker STL. Result is cached so it only loads once.
 * Pass a different url to swap in a new design at runtime.
 */
export async function loadMarkerGeometry(url = MARKER_URL) {
  if (_cachedMarkerGeo) return _cachedMarkerGeo;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Marker fetch failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  const geo = new STLLoader().parse(buf);
  geo.computeVertexNormals();
  _cachedMarkerGeo = geo;
  return geo;
}

export function clearMarkerCache() {
  _cachedMarkerGeo = null;
}

/**
 * Compute a shape signature from a geometry.
 * Returns the three OBB extents (long, mid, short), their ratios, and the
 * characteristic size used for neighbourhood search.
 *
 * @param {THREE.BufferGeometry} geo
 */
export function computeSignature(geo) {
  const pos = geo.attributes.position.array;
  const pca = computePCA(pos);
  if (!pca) return null;

  const { centroid, longAxis: la } = pca;
  const longAxis = new THREE.Vector3(la[0], la[1], la[2]).normalize();

  // Build orthonormal basis (longAxis, perp1, perp2)
  const perp1 = new THREE.Vector3();
  if (Math.abs(longAxis.x) < 0.9) perp1.set(1, 0, 0); else perp1.set(0, 1, 0);
  perp1.sub(longAxis.clone().multiplyScalar(perp1.dot(longAxis))).normalize();
  const perp2 = new THREE.Vector3().crossVectors(longAxis, perp1).normalize();

  let minL = Infinity, maxL = -Infinity;
  let minP1 = Infinity, maxP1 = -Infinity;
  let minP2 = Infinity, maxP2 = -Infinity;
  const n = pos.length / 3;
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3] - centroid[0];
    const y = pos[i * 3 + 1] - centroid[1];
    const z = pos[i * 3 + 2] - centroid[2];
    const l  = x * longAxis.x + y * longAxis.y + z * longAxis.z;
    const p1 = x * perp1.x   + y * perp1.y   + z * perp1.z;
    const p2 = x * perp2.x   + y * perp2.y   + z * perp2.z;
    if (l  < minL)  minL  = l;  if (l  > maxL)  maxL  = l;
    if (p1 < minP1) minP1 = p1; if (p1 > maxP1) maxP1 = p1;
    if (p2 < minP2) minP2 = p2; if (p2 > maxP2) maxP2 = p2;
  }

  const dims = [maxL - minL, maxP1 - minP1, maxP2 - minP2].sort((a, b) => b - a);
  const [longDim, midDim, shortDim] = dims;

  return {
    longDim,
    midDim,
    shortDim,
    // compactness: 0 = very elongated (like a limb), 1 = cubic (like a marker)
    compactness: shortDim / Math.max(longDim, 0.001),
    midRatio:    midDim  / Math.max(longDim, 0.001),
    characteristicSize: longDim,
    centroid: new THREE.Vector3(...centroid),
  };
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function buildSpatialGrid(pos, sampleStep, cellSize) {
  const cells = new Map();
  const n = pos.length / 3;
  for (let i = 0; i < n; i += sampleStep) {
    const gx = Math.floor(pos[i * 3]     / cellSize);
    const gy = Math.floor(pos[i * 3 + 1] / cellSize);
    const gz = Math.floor(pos[i * 3 + 2] / cellSize);
    const key = `${gx},${gy},${gz}`;
    if (!cells.has(key)) cells.set(key, { gx, gy, gz, indices: [] });
    cells.get(key).indices.push(i);
  }
  return cells;
}

function scoreNeighborhood(pos, indices, markerSig) {
  if (indices.length < 6) return 0;

  const neighborPos = new Float32Array(indices.length * 3);
  for (let i = 0; i < indices.length; i++) {
    const vi = indices[i];
    neighborPos[i * 3]     = pos[vi * 3];
    neighborPos[i * 3 + 1] = pos[vi * 3 + 1];
    neighborPos[i * 3 + 2] = pos[vi * 3 + 2];
  }

  const pca = computePCA(neighborPos);
  if (!pca) return 0;

  const { centroid, longAxis: la } = pca;
  const longAxis = new THREE.Vector3(la[0], la[1], la[2]).normalize();
  const perp1 = new THREE.Vector3();
  if (Math.abs(longAxis.x) < 0.9) perp1.set(1, 0, 0); else perp1.set(0, 1, 0);
  perp1.sub(longAxis.clone().multiplyScalar(perp1.dot(longAxis))).normalize();
  const perp2 = new THREE.Vector3().crossVectors(longAxis, perp1).normalize();

  let minL = Infinity, maxL = -Infinity;
  let minP1 = Infinity, maxP1 = -Infinity;
  let minP2 = Infinity, maxP2 = -Infinity;
  for (let i = 0; i < indices.length; i++) {
    const vi = indices[i];
    const x = pos[vi * 3]     - centroid[0];
    const y = pos[vi * 3 + 1] - centroid[1];
    const z = pos[vi * 3 + 2] - centroid[2];
    const l  = x * longAxis.x + y * longAxis.y + z * longAxis.z;
    const p1 = x * perp1.x   + y * perp1.y   + z * perp1.z;
    const p2 = x * perp2.x   + y * perp2.y   + z * perp2.z;
    if (l  < minL)  minL  = l;  if (l  > maxL)  maxL  = l;
    if (p1 < minP1) minP1 = p1; if (p1 > maxP1) maxP1 = p1;
    if (p2 < minP2) minP2 = p2; if (p2 > maxP2) maxP2 = p2;
  }

  const dims = [maxL - minL, maxP1 - minP1, maxP2 - minP2].sort((a, b) => b - a);
  const compactness = dims[2] / Math.max(dims[0], 0.001);
  const midRatio    = dims[1] / Math.max(dims[0], 0.001);

  const compactnessScore = 1 - Math.abs(compactness - markerSig.compactness);
  const midRatioScore    = 1 - Math.abs(midRatio    - markerSig.midRatio);
  const sizeScore = Math.exp(
    -Math.abs(dims[0] - markerSig.longDim) / Math.max(markerSig.longDim, 1)
  );

  return compactnessScore * 0.45 + midRatioScore * 0.25 + sizeScore * 0.30;
}

// ─── Main detection export ───────────────────────────────────────────────────

/**
 * Search a scan geometry for a region matching the marker's shape signature.
 *
 * @param {THREE.BufferGeometry} scanGeo
 * @param {THREE.BufferGeometry} markerGeo
 * @param {object} options
 *   maxSampleVerts  – cap how many scan vertices to consider (performance)
 *   gridExpansion   – how many cells to expand around each seed (1 = 3³ block)
 * @returns {{ center: THREE.Vector3, radius: number,
 *             vertexIndices: Uint32Array, confidence: number } | null}
 */
export function detectMarkerInScan(scanGeo, markerGeo, options = {}) {
  const { maxSampleVerts = 20000, gridExpansion = 1 } = options;

  const markerSig = computeSignature(markerGeo);
  if (!markerSig) return null;

  const pos = scanGeo.attributes.position.array;
  const totalVerts = pos.length / 3;
  const step = Math.max(1, Math.floor(totalVerts / maxSampleVerts));

  const S = markerSig.characteristicSize;
  const cells = buildSpatialGrid(pos, step, S);

  let bestScore = -1;
  let bestCentroid = null;

  for (const [, seedCell] of cells) {
    // Collect indices from all cells in the (2*gridExpansion+1)³ block
    const neighborhood = [];
    for (let dx = -gridExpansion; dx <= gridExpansion; dx++) {
      for (let dy = -gridExpansion; dy <= gridExpansion; dy++) {
        for (let dz = -gridExpansion; dz <= gridExpansion; dz++) {
          const key = `${seedCell.gx + dx},${seedCell.gy + dy},${seedCell.gz + dz}`;
          const cell = cells.get(key);
          if (cell) neighborhood.push(...cell.indices);
        }
      }
    }

    if (neighborhood.length < 6) continue;

    const score = scoreNeighborhood(pos, neighborhood, markerSig);

    if (score > bestScore) {
      bestScore = score;
      // Centroid of this neighbourhood
      let sx = 0, sy = 0, sz = 0;
      for (const vi of neighborhood) {
        sx += pos[vi * 3]; sy += pos[vi * 3 + 1]; sz += pos[vi * 3 + 2];
      }
      bestCentroid = new THREE.Vector3(
        sx / neighborhood.length,
        sy / neighborhood.length,
        sz / neighborhood.length,
      );
    }
  }

  if (!bestCentroid || bestScore < 0.25) return null;

  // Collect all original vertices (not just sampled) within the marker radius
  const highlightR = S * 0.65;
  const finalIndices = [];
  const cx = bestCentroid.x, cy = bestCentroid.y, cz = bestCentroid.z;
  for (let i = 0; i < totalVerts; i++) {
    const dx = pos[i * 3] - cx;
    const dy = pos[i * 3 + 1] - cy;
    const dz = pos[i * 3 + 2] - cz;
    if (dx * dx + dy * dy + dz * dz <= highlightR * highlightR) {
      finalIndices.push(i);
    }
  }

  return {
    center: bestCentroid,
    radius: highlightR,
    vertexIndices: new Uint32Array(finalIndices),
    confidence: bestScore,
  };
}
