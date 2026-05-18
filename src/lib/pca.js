/**
 * PCA via power iteration — direct port of the reference HTML algorithm.
 * Returns { centroid: [cx,cy,cz], longAxis: [x,y,z] }
 */
export function computePCA(positions) {
  const n = positions.length / 3;
  if (n < 3) return null;

  // Centroid
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < n; i++) {
    cx += positions[i*3]; cy += positions[i*3+1]; cz += positions[i*3+2];
  }
  cx /= n; cy /= n; cz /= n;

  // Covariance matrix (upper triangle)
  let c00=0, c01=0, c02=0, c11=0, c12=0, c22=0;
  for (let i = 0; i < n; i++) {
    const x = positions[i*3]-cx, y = positions[i*3+1]-cy, z = positions[i*3+2]-cz;
    c00+=x*x; c01+=x*y; c02+=x*z; c11+=y*y; c12+=y*z; c22+=z*z;
  }
  c00/=n; c01/=n; c02/=n; c11/=n; c12/=n; c22/=n;

  // Power iteration — converges to dominant eigenvector (long axis)
  const powerIter = (v) => {
    for (let iter = 0; iter < 64; iter++) {
      const nx = c00*v[0] + c01*v[1] + c02*v[2];
      const ny = c01*v[0] + c11*v[1] + c12*v[2];
      const nz = c02*v[0] + c12*v[1] + c22*v[2];
      const l  = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1;
      v[0]=nx/l; v[1]=ny/l; v[2]=nz/l;
    }
    return v;
  };

  const longAxis = powerIter([0.577, 0.577, 0.577]);
  return { centroid: [cx, cy, cz], longAxis };
}
