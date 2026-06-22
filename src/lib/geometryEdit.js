import * as THREE from 'three';

/**
 * Bake the current displayed positions into a new non-indexed BufferGeometry.
 * Call this when entering edit mode so the transform is permanently applied.
 */
export function bakeGeometry(geometry, transformedPositions) {
  const srcPos = transformedPositions
    ? new Float32Array(transformedPositions)
    : new Float32Array(geometry.attributes.position.array);

  const baked = new THREE.BufferGeometry();
  baked.setAttribute('position', new THREE.BufferAttribute(srcPos, 3));
  if (geometry.index) baked.setIndex(geometry.index.clone());

  const flat = baked.toNonIndexed();
  flat.computeVertexNormals();
  return flat;
}

/**
 * Ray-casting point-in-polygon test.
 * polygon is an array of { x, y } screen-space points.
 */
export function pointInPolygon(px, py, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if ((yi > py) !== (yj > py) &&
        px < (xj - xi) * (py - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Return the Set of face indices whose screen-space centroid falls inside
 * the lasso polygon.
 *
 * Assumes non-indexed geometry: face f occupies positions[f*9 .. f*9+8].
 *
 * @param {Float32Array} positions  - flat non-indexed position array
 * @param {{ x: number, y: number }[]} polygon - lasso points in screen pixels
 * @param {THREE.Camera} camera
 * @param {number} width  - viewport pixel width
 * @param {number} height - viewport pixel height
 * @returns {Set<number>}
 */
export function selectFacesWithLasso(positions, polygon, camera, width, height) {
  if (polygon.length < 3) return new Set();

  const selected = new Set();
  const faceCount = positions.length / 9;
  const v = new THREE.Vector3();

  for (let f = 0; f < faceCount; f++) {
    const b = f * 9;
    // Face centroid in world space
    v.set(
      (positions[b]     + positions[b + 3] + positions[b + 6]) / 3,
      (positions[b + 1] + positions[b + 4] + positions[b + 7]) / 3,
      (positions[b + 2] + positions[b + 5] + positions[b + 8]) / 3,
    );

    // Project to NDC, skip faces behind the camera
    v.project(camera);
    if (v.z > 1) continue;

    const sx = (v.x + 1) / 2 * width;
    const sy = (1 - v.y) / 2 * height;

    if (pointInPolygon(sx, sy, polygon)) {
      selected.add(f);
    }
  }

  return selected;
}

/**
 * Remove selected faces from a flat non-indexed position array.
 * Returns a new Float32Array with those faces deleted.
 *
 * @param {Float32Array} positions
 * @param {Set<number>} faceSet
 * @returns {Float32Array}
 */
export function deleteFaces(positions, faceSet) {
  const faceCount = positions.length / 9;
  const keepCount = faceCount - faceSet.size;
  const result = new Float32Array(keepCount * 9);

  let wi = 0;
  for (let f = 0; f < faceCount; f++) {
    if (faceSet.has(f)) continue;
    result.set(positions.subarray(f * 9, f * 9 + 9), wi * 9);
    wi++;
  }

  return result;
}

/**
 * Build a Float32Array of positions for just the selected faces.
 * Used to drive the red highlight mesh in the viewport.
 *
 * @param {Float32Array} positions
 * @param {Set<number>} faceSet
 * @returns {Float32Array}
 */
export function buildHighlightPositions(positions, faceSet) {
  const arr = new Float32Array(faceSet.size * 9);
  let wi = 0;
  for (const f of faceSet) {
    arr.set(positions.subarray(f * 9, f * 9 + 9), wi * 9);
    wi++;
  }
  return arr;
}
