import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

/**
 * Load an STL or OBJ file from a File object.
 * Returns a Promise<THREE.BufferGeometry>.
 */
export function loadFile(file) {
  return new Promise((resolve, reject) => {
    const ext = file.name.split('.').pop().toLowerCase();
    const url = URL.createObjectURL(file);

    if (ext === 'stl') {
      const loader = new STLLoader();
      loader.load(
        url,
        (geometry) => {
          URL.revokeObjectURL(url);
          geometry.computeVertexNormals();
          resolve(geometry);
        },
        undefined,
        (err) => { URL.revokeObjectURL(url); reject(err); }
      );
    } else if (ext === 'obj') {
      const loader = new OBJLoader();
      loader.load(
        url,
        (group) => {
          URL.revokeObjectURL(url);
          // Merge all geometries in the group
          const geometries = [];
          group.traverse((child) => {
            if (child.isMesh) {
              const g = child.geometry.clone();
              g.applyMatrix4(child.matrixWorld);
              geometries.push(g);
            }
          });
          if (geometries.length === 0) {
            reject(new Error('No meshes found in OBJ file'));
            return;
          }
          // Merge manually
          let totalVerts = 0;
          for (const g of geometries) totalVerts += g.attributes.position.count;
          const merged = new Float32Array(totalVerts * 3);
          let offset = 0;
          for (const g of geometries) {
            merged.set(g.attributes.position.array, offset);
            offset += g.attributes.position.array.length;
          }
          const mergedGeo = new THREE.BufferGeometry();
          mergedGeo.setAttribute('position', new THREE.BufferAttribute(merged, 3));
          mergedGeo.computeVertexNormals();
          resolve(mergedGeo);
        },
        undefined,
        (err) => { URL.revokeObjectURL(url); reject(err); }
      );
    } else {
      reject(new Error(`Unsupported file type: .${ext}`));
    }
  });
}
