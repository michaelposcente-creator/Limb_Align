import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

function makeTextSprite(text, hexColor) {
  const W = 256, H = 56;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 28px monospace';
  ctx.fillStyle = hexColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, W / 2, H / 2);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({
    map: tex, depthTest: false, depthWrite: false, fog: false, transparent: true,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.renderOrder = 1000;
  sprite.scale.set(36, 8, 1);
  return sprite;
}

const Viewport3D = forwardRef(function Viewport3D({
  geometry,
  transformedPositions,
  wireframe,
  resetViewKey,
  showGrid,
  statusMsg,
}, ref) {
  const mountRef = useRef(null);
  const threeRef = useRef(null);

  // Expose camera XY angle to parent for "Anterior Facing Me"
  useImperativeHandle(ref, () => ({
    getCameraXYAngle() {
      const three = threeRef.current;
      if (!three) return 0;
      const cam = three.camera.position;
      const tgt = three.controls.target;
      return Math.atan2(cam.y - tgt.y, cam.x - tgt.x);
    },
  }));

  // Initialize Three.js scene once
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = false;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0f14);
    scene.fog = new THREE.FogExp2(0x0d0f14, 0.003);

    // Camera — Z-up, isometric view showing all three axes
    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.1, 5000);
    camera.up.set(0, 0, 1);
    camera.position.set(300, 300, 220);

    // XY-plane wireframe grid
    const xyGrid = new THREE.GridHelper(400, 20, 0x1a3a2a, 0x1a3a2a);
    xyGrid.rotation.x = Math.PI / 2;
    xyGrid.material.transparent = true;
    xyGrid.material.opacity = 0.6;
    scene.add(xyGrid);

    // Axis arrows
    const AXIS_LENGTH = 100;
    const SHAFT_R = 1.8;
    const CONE_R = 5;
    const CONE_H = 16;

    function makeArrow(color) {
      const mat = new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false, fog: false });
      const group = new THREE.Group();
      group.renderOrder = 999;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(SHAFT_R, SHAFT_R, AXIS_LENGTH, 10), mat);
      shaft.position.y = AXIS_LENGTH / 2;
      shaft.renderOrder = 999;
      group.add(shaft);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(CONE_R, CONE_H, 10), mat);
      cone.position.y = AXIS_LENGTH + CONE_H / 2;
      cone.renderOrder = 999;
      group.add(cone);
      return group;
    }

    const xArrow = makeArrow(0xef5350);
    xArrow.rotation.z = -Math.PI / 2;
    scene.add(xArrow);

    const yArrow = makeArrow(0x66bb6a);
    scene.add(yArrow);

    const zArrow = makeArrow(0x42a5f5);
    zArrow.rotation.x = Math.PI / 2;
    scene.add(zArrow);

    // Origin sphere
    const originGeo = new THREE.SphereGeometry(4, 16, 16);
    const originMat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false, fog: false });
    const originSphere = new THREE.Mesh(originGeo, originMat);
    originSphere.renderOrder = 999;
    scene.add(originSphere);

    // Axis label sprites — always face camera
    const tipOffset = AXIS_LENGTH + CONE_H + 18;
    const xLabel = makeTextSprite('Anterior', '#ef5350');
    xLabel.position.set(tipOffset, 0, 0);
    scene.add(xLabel);

    const zLabel = makeTextSprite('Proximal', '#42a5f5');
    zLabel.position.set(0, 0, tipOffset);
    scene.add(zLabel);

    // Orbit controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 20;
    controls.maxDistance = 2000;

    let animId;
    function animate() {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    const observer = new ResizeObserver(() => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    });
    observer.observe(mount);

    threeRef.current = { scene, camera, renderer, controls, mesh: null, animId, xyGrid };

    return () => {
      cancelAnimationFrame(animId);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      threeRef.current = null;
    };
  }, []);

  // Update mesh when geometry or transformedPositions changes
  useEffect(() => {
    const three = threeRef.current;
    if (!three) return;
    const { scene } = three;

    if (three.mesh) {
      scene.remove(three.mesh);
      three.mesh.geometry.dispose();
      three.mesh.material.dispose();
      three.mesh = null;
    }

    if (!geometry) return;

    const displayGeo = new THREE.BufferGeometry();
    const positions = transformedPositions || geometry.attributes.position.array;
    displayGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    if (geometry.index) displayGeo.setIndex(geometry.index.clone());
    displayGeo.computeVertexNormals();
    displayGeo.computeBoundingBox();

    const mat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      vertexShader: /* glsl */`
        varying vec3 vViewNormal;
        void main() {
          vViewNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        varying vec3 vViewNormal;
        void main() {
          vec3 n = normalize(vViewNormal);
          float key  = max(dot(n, normalize(vec3(-0.5, 0.8, 0.6))), 0.0);
          float fill = max(dot(n, normalize(vec3( 0.5,-0.3, 0.5))), 0.0);
          float light = 0.28 + 0.58 * key + 0.18 * fill;
          gl_FragColor = vec4(vec3(0.545, 0.753, 0.847) * light, 1.0);
        }
      `,
    });

    const mesh = new THREE.Mesh(displayGeo, mat);
    scene.add(mesh);
    three.mesh = mesh;

    // Isometric Z-up view centered on mesh
    const box = new THREE.Box3().setFromObject(mesh);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const d = Math.max(size.x, size.y, size.z);
    three.controls.target.copy(center);
    three.camera.up.set(0, 0, 1);
    three.camera.position.set(center.x + d, center.y + d, center.z + d * 0.7);
    three.camera.far = d * 20;
    three.camera.updateProjectionMatrix();
    three.controls.update();
  }, [geometry, transformedPositions]);

  // Wireframe toggle
  useEffect(() => {
    const three = threeRef.current;
    if (!three?.mesh) return;
    three.mesh.material.wireframe = wireframe;
  }, [wireframe]);

  // Grid visibility toggle
  useEffect(() => {
    const three = threeRef.current;
    if (!three?.xyGrid) return;
    three.xyGrid.visible = showGrid !== false;
  }, [showGrid]);

  // Snap camera after auto-orient
  useEffect(() => {
    if (!resetViewKey) return;
    const three = threeRef.current;
    if (!three?.mesh) return;

    const box = new THREE.Box3().setFromObject(three.mesh);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const d = Math.max(size.x, size.y, size.z);

    three.controls.target.set(0, 0, center.z);
    three.camera.up.set(0, 0, 1);
    three.camera.position.set(d, d, center.z + d * 0.5);
    three.camera.far = d * 20;
    three.camera.updateProjectionMatrix();
    three.controls.update();
  }, [resetViewKey]);

  return (
    <div ref={mountRef} className="viewport-container">
      {statusMsg && <div className="status-bar">{statusMsg}</div>}
    </div>
  );
});

export default Viewport3D;
