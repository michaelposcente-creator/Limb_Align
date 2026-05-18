import * as THREE from 'three';
import { computePCA } from './pca.js';

/**
 * Direct port of autoOrient() + buildTransform() from the reference HTML.
 *
 * Returns an analysis object used by computeOrientTransform.
 */
export function analyzeMesh(geometry) {
  const pos     = geometry.attributes.position.array;
  const normals = geometry.attributes.normal?.array ?? null;
  const n       = pos.length / 3;

  const pca = computePCA(pos);
  if (!pca) return null;

  const { centroid, longAxis: la } = pca;
  const [cx, cy, cz] = centroid;
  const longAxis = new THREE.Vector3(la[0], la[1], la[2]).normalize();

  // ── Project all verts onto long axis, find extremes ──────────────────────
  let minP = Infinity, maxP = -Infinity, minIdx = 0, maxIdx = 0;
  for (let i = 0; i < n; i++) {
    const p = (pos[i*3]-cx)*longAxis.x + (pos[i*3+1]-cy)*longAxis.y + (pos[i*3+2]-cz)*longAxis.z;
    if (p < minP) { minP = p; minIdx = i; }
    if (p > maxP) { maxP = p; maxIdx = i; }
  }

  const endA = new THREE.Vector3(pos[minIdx*3], pos[minIdx*3+1], pos[minIdx*3+2]);
  const endB = new THREE.Vector3(pos[maxIdx*3], pos[maxIdx*3+1], pos[maxIdx*3+2]);

  // ── radiusAt: avg 3-D distance to endpoint for ~300 sampled nearby verts ──
  const radiusAt = (endPt) => {
    const step   = Math.max(1, Math.floor(n / 300));
    const thresh = (maxP - minP) * 0.1;
    let r = 0, c = 0;
    const ep = endPt.dot(longAxis) - (cx*longAxis.x + cy*longAxis.y + cz*longAxis.z);
    for (let i = 0; i < n; i += step) {
      const vx = pos[i*3]-cx, vy = pos[i*3+1]-cy, vz = pos[i*3+2]-cz;
      const proj = vx*longAxis.x + vy*longAxis.y + vz*longAxis.z;
      if (Math.abs(proj - ep) < thresh) {
        const dx = pos[i*3]-endPt.x, dy = pos[i*3+1]-endPt.y, dz = pos[i*3+2]-endPt.z;
        r += Math.sqrt(dx*dx + dy*dy + dz*dz);
        c++;
      }
    }
    return c > 0 ? r / c : 1e9;
  };

  const rA = radiusAt(endA);
  const rB = radiusAt(endB);

  // Distal end = smaller radius
  const distalEnd = rA < rB ? endA : endB;
  let zAxis = rA < rB ? longAxis.clone() : longAxis.clone().negate();

  // Make sure zAxis points AWAY from distal (proximal is up)
  if (zAxis.dot(distalEnd.clone().sub(new THREE.Vector3(cx, cy, cz))) > 0) zAxis.negate();

  // ── Anterior direction via normal sectors ─────────────────────────────────
  let bestDir = new THREE.Vector3(1, 0, 0);

  if (normals) {
    const sectors     = 36;
    const sectorScore = new Float32Array(sectors);
    const sectorCount = new Int32Array(sectors);
    const zVec        = zAxis.clone();

    const basisX = new THREE.Vector3();
    if (Math.abs(zVec.x) < 0.9) basisX.set(1, 0, 0); else basisX.set(0, 1, 0);
    basisX.sub(zVec.clone().multiplyScalar(basisX.dot(zVec))).normalize();
    const basisY = new THREE.Vector3().crossVectors(zVec, basisX).normalize();

    for (let i = 0; i < n; i++) {
      const nx = normals[i*3], ny = normals[i*3+1], nz = normals[i*3+2];
      const dot    = nx*zVec.x + ny*zVec.y + nz*zVec.z;
      const perp_x = nx - zVec.x*dot;
      const perp_y = ny - zVec.y*dot;
      const perp_z = nz - zVec.z*dot;
      const angle  = Math.atan2(
        perp_x*basisY.x + perp_y*basisY.y + perp_z*basisY.z,
        perp_x*basisX.x + perp_y*basisX.y + perp_z*basisX.z
      );
      const s = Math.floor(((angle + Math.PI) / (2*Math.PI)) * sectors) % sectors;
      sectorScore[s] += Math.sqrt(perp_x*perp_x + perp_y*perp_y + perp_z*perp_z);
      sectorCount[s]++;
    }

    let maxScore = -1, bestSector = 0;
    for (let s = 0; s < sectors; s++) {
      if (sectorCount[s] > 0) {
        const avg = sectorScore[s] / sectorCount[s];
        if (avg > maxScore) { maxScore = avg; bestSector = s; }
      }
    }
    const bestAngle = ((bestSector + 0.5) / sectors) * 2*Math.PI - Math.PI;
    bestDir = basisX.clone().multiplyScalar(Math.cos(bestAngle))
                    .add(basisY.clone().multiplyScalar(Math.sin(bestAngle)));
  }

  const xAxis = bestDir.clone().sub(zAxis.clone().multiplyScalar(bestDir.dot(zAxis))).normalize();
  const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();

  // Confidence: how different the two end radii are
  const larger  = Math.max(rA, rB);
  const smaller = Math.min(rA, rB);
  const confidence = larger > 0 ? Math.round((1 - smaller / larger) * 100) : 0;

  return {
    centroid,
    distalEnd,
    zAxis,
    xAxis,
    yAxis,
    confidence,
    limbLength: maxP - minP,
  };
}

/**
 * Direct port of buildTransform() from the reference HTML.
 * R = makeBasis(xAxis, yAxis, zAxis), Rinv = R.transpose()
 * transform = Rinv * translate(-distal)
 *
 * Returns a 16-element column-major array compatible with applyTransformToGeometry.
 */
export function computeOrientTransform(analysis, overrideDistal) {
  const { zAxis, xAxis, yAxis } = analysis;
  const distal = overrideDistal
    ? new THREE.Vector3(...overrideDistal)
    : analysis.distalEnd;

  const R    = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
  const Rinv = R.clone().transpose();
  const T    = new THREE.Matrix4().makeTranslation(-distal.x, -distal.y, -distal.z);
  const M    = new THREE.Matrix4().multiplyMatrices(Rinv, T);

  return M.elements; // column-major Float32Array, 16 elements
}

/**
 * Compute a 4×4 transform from three manually-picked landmark points.
 *   distal → origin, distal→proximal → +Z, anterior → +X, cross(Z,X) → +Y
 */
export function computeLandmarkTransform(distal, proximal, anterior) {
  const d  = new THREE.Vector3(...distal);
  const p  = new THREE.Vector3(...proximal);
  const a  = new THREE.Vector3(...anterior);

  const zAxis = new THREE.Vector3().subVectors(p, d).normalize();
  const toA   = new THREE.Vector3().subVectors(a, d);
  const xAxis = toA.sub(zAxis.clone().multiplyScalar(toA.dot(zAxis))).normalize();
  const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();

  const R    = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
  const Rinv = R.clone().transpose();
  const T    = new THREE.Matrix4().makeTranslation(-d.x, -d.y, -d.z);
  const M    = new THREE.Matrix4().multiplyMatrices(Rinv, T);

  return M.elements;
}

/**
 * Compute the volume (mm³) of the largest connected body in the geometry.
 *
 * Algorithm:
 * 1. Deduplicate vertices by position using a spatial hash (handles STL's
 *    per-triangle vertex storage where shared vertices have identical values).
 * 2. Union-Find over deduplicated vertices to identify connected components.
 * 3. Signed-tetrahedron (divergence theorem) volume for faces belonging to
 *    the largest component only.
 */
export function computeVolumeOfLargestComponent(geometry) {
  const src = geometry.attributes.position.array;
  const vertCount = src.length / 3;

  // Face indices — create implicit indices for non-indexed (STL) geometry
  const indices = geometry.index
    ? geometry.index.array
    : (() => { const a = new Uint32Array(vertCount); for (let i=0;i<vertCount;i++) a[i]=i; return a; })();
  const faceCount = indices.length / 3;

  // ── 1. Deduplicate vertices ───────────────────────────────────────────────
  const posMap = new Map();
  const canon  = new Int32Array(vertCount);
  let U = 0;
  for (let i = 0; i < vertCount; i++) {
    const x = src[i*3], y = src[i*3+1], z = src[i*3+2];
    // 1e4 = 0.0001 mm tolerance — safely merges shared STL vertices
    const key = `${Math.round(x*1e4)},${Math.round(y*1e4)},${Math.round(z*1e4)}`;
    if (!posMap.has(key)) posMap.set(key, U++);
    canon[i] = posMap.get(key);
  }

  // ── 2. Union-Find ─────────────────────────────────────────────────────────
  const parent = new Int32Array(U);
  const sz     = new Int32Array(U).fill(1);
  for (let i = 0; i < U; i++) parent[i] = i;

  function find(x) {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  }
  function unite(a, b) {
    a = find(a); b = find(b);
    if (a === b) return;
    if (sz[a] < sz[b]) { const t = a; a = b; b = t; }
    parent[b] = a; sz[a] += sz[b];
  }

  for (let f = 0; f < faceCount; f++) {
    const a = canon[indices[f*3]], b = canon[indices[f*3+1]], c = canon[indices[f*3+2]];
    unite(a, b); unite(a, c);
  }

  // ── 3. Largest component root ─────────────────────────────────────────────
  const compSize = new Map();
  for (let i = 0; i < U; i++) {
    const r = find(i);
    compSize.set(r, (compSize.get(r) || 0) + 1);
  }
  let largestRoot = -1, largestSize = 0;
  for (const [root, size] of compSize) {
    if (size > largestSize) { largestSize = size; largestRoot = root; }
  }

  // ── 4. Signed-tetrahedron volume (divergence theorem) ────────────────────
  let vol = 0;
  for (let f = 0; f < faceCount; f++) {
    if (find(canon[indices[f*3]]) !== largestRoot) continue;
    const ia = indices[f*3], ib = indices[f*3+1], ic = indices[f*3+2];
    const ax = src[ia*3], ay = src[ia*3+1], az = src[ia*3+2];
    const bx = src[ib*3], by = src[ib*3+1], bz = src[ib*3+2];
    const cx = src[ic*3], cy = src[ic*3+1], cz = src[ic*3+2];
    vol += ax*(by*cz - bz*cy) + bx*(cy*az - cz*ay) + cx*(ay*bz - az*by);
  }

  return Math.abs(vol) / 6; // mm³
}

/**
 * Apply a column-major 4×4 matrix to all vertex positions of a geometry.
 */
export function applyTransformToGeometry(geometry, matElements) {
  const src = geometry.attributes.position.array;
  const n   = src.length / 3;
  const dst = new Float32Array(src.length);
  const [m0,m1,m2,m3, m4,m5,m6,m7, m8,m9,m10,m11, m12,m13,m14,m15] = matElements;

  for (let i = 0; i < n; i++) {
    const x = src[i*3], y = src[i*3+1], z = src[i*3+2];
    dst[i*3]   = m0*x + m4*y + m8*z  + m12;
    dst[i*3+1] = m1*x + m5*y + m9*z  + m13;
    dst[i*3+2] = m2*x + m6*y + m10*z + m14;
  }
  return dst;
}
