import { useState, useCallback, useMemo, useRef } from 'react';
import { version } from '../package.json';
import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import LeftPanel from './components/LeftPanel.jsx';
import RightPanel from './components/RightPanel.jsx';
import Viewport3D from './components/Viewport3D.jsx';
import { loadFile } from './lib/loaders.js';
import {
  analyzeMesh,
  computeOrientTransform,
  applyTransformToGeometry,
  computeVolumeOfLargestComponent,
} from './lib/meshAnalysis.js';
import { loadMarkerGeometry, detectMarkerInScan } from './lib/markerDetection.js';
import { bakeGeometry, buildHighlightPositions, deleteFaces } from './lib/geometryEdit.js';

function fmtFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function App() {
  const [fileName, setFileName]   = useState(null);
  const [fileSize, setFileSize]   = useState(null);
  const [fileExt, setFileExt]     = useState(null);
  const [geometry, setGeometry]   = useState(null);
  const [analysis, setAnalysis]   = useState(null);

  const [wireframe, setWireframe] = useState(false);
  const [showGrid, setShowGrid]   = useState(true);
  const [showOriented, setShowOriented] = useState(false);

  // Extra Z-rotation applied after auto-orient (for "Anterior Facing Me")
  const [anteriorAngle, setAnteriorAngle] = useState(0);

  const [loading, setLoading]     = useState(false);
  const [loaderMsg, setLoaderMsg] = useState(null);
  const [statusMsg, setStatusMsg] = useState(null);
  const [error, setError]         = useState(null);

  const [orientStatus, setOrientStatus] = useState('none');
  const [orientMethod, setOrientMethod] = useState(null);
  const [resetViewKey, setResetViewKey] = useState(0);
  const [markerRegion, setMarkerRegion] = useState(null);

  // Edit mode
  const [editMode,          setEditMode]          = useState(false);
  const [selectedFaces,     setSelectedFaces]     = useState(null);   // Set<number>
  const [highlightPositions, setHighlightPositions] = useState(null); // Float32Array
  const [undoStack,         setUndoStack]         = useState([]);     // Float32Array[]

  const viewportRef = useRef(null);

  // Build the orient transform, composing an optional Z rotation for anterior correction
  const orientTransform = useMemo(() => {
    if (!analysis) return null;
    const base = computeOrientTransform(analysis);

    if (anteriorAngle === 0) return base;

    // Rotate around Z by -anteriorAngle to bring the camera-facing direction to +X
    const M   = new THREE.Matrix4().fromArray(base);
    const Rz  = new THREE.Matrix4().makeRotationZ(-anteriorAngle);
    return new THREE.Matrix4().multiplyMatrices(Rz, M).elements;
  }, [analysis, anteriorAngle]);

  const transformedPositions = useMemo(() => {
    if (!geometry || !orientTransform || !showOriented) return null;
    return applyTransformToGeometry(geometry, orientTransform);
  }, [geometry, orientTransform, showOriented]);

  // ── File load ───────────────────────────────────────────────────────────
  const handleFile = useCallback(async (file) => {
    setLoading(true);
    setError(null);
    setAnalysis(null);
    setGeometry(null);
    setShowOriented(false);
    setOrientStatus('none');
    setOrientMethod(null);
    setAnteriorAngle(0);
    setMarkerRegion(null);
    setStatusMsg(null);
    try {
      const geo = await loadFile(file);
      const result = analyzeMesh(geo);
      const vertexCount = geo.attributes.position.count;
      result.vertexCount = vertexCount;
      result.faceCount = Math.round(
        geo.index ? geo.index.count / 3 : vertexCount / 3
      );
      geo.computeBoundingBox();
      const bb = geo.boundingBox;
      result.boundsX = bb.max.x - bb.min.x;
      result.boundsY = bb.max.y - bb.min.y;
      result.boundsZ = bb.max.z - bb.min.z;
      result.volumeMm3 = computeVolumeOfLargestComponent(geo);

      setFileName(file.name);
      setFileSize(fmtFileSize(file.size));
      setFileExt(file.name.split('.').pop().toUpperCase());
      setGeometry(geo);
      setAnalysis(result);
      setStatusMsg(`Loaded ${file.name}`);
    } catch (e) {
      setError(e.message);
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  LeftPanel._onFile = handleFile;

  // ── Auto-orient ─────────────────────────────────────────────────────────
  const handleAutoOrient = useCallback(() => {
    if (!geometry) return;
    setLoaderMsg('Running PCA analysis...');
    setLoading(true);
    const delay = (ms) => new Promise(res => setTimeout(res, ms));

    (async () => {
      try {
        await delay(300);
        setLoaderMsg('Detecting distal tip...');
        await delay(300);
        setLoaderMsg('Building transform...');
        await delay(300);

        const result = analyzeMesh(geometry);
        result.vertexCount = geometry.attributes.position.count;
        result.faceCount = Math.round(
          geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3
        );
        geometry.computeBoundingBox();
        const bb = geometry.boundingBox;
        result.boundsX = bb.max.x - bb.min.x;
        result.boundsY = bb.max.y - bb.min.y;
        result.boundsZ = bb.max.z - bb.min.z;
        result.volumeMm3 = computeVolumeOfLargestComponent(geometry);

        setAnteriorAngle(0);
        setAnalysis(result);
        setShowOriented(true);
        setOrientStatus('oriented');
        setOrientMethod('Auto-PCA');
        setStatusMsg('Auto-orientation complete');
        setResetViewKey(k => k + 1);

        // Marker detection — non-blocking, failure is silent
        try {
          setLoaderMsg('Detecting marker...');
          await delay(100);
          const markerGeo = await loadMarkerGeometry();
          const detection = detectMarkerInScan(geometry, markerGeo);
          if (detection) {
            // Pack the detected vertex positions for the point cloud overlay
            const pos = geometry.attributes.position.array;
            const pts = new Float32Array(detection.vertexIndices.length * 3);
            detection.vertexIndices.forEach((vi, i) => {
              pts[i * 3]     = pos[vi * 3];
              pts[i * 3 + 1] = pos[vi * 3 + 1];
              pts[i * 3 + 2] = pos[vi * 3 + 2];
            });
            setMarkerRegion({ ...detection, vertexPositions: pts });
            setStatusMsg('Auto-orientation complete · Marker detected');
          } else {
            setMarkerRegion(null);
          }
        } catch {
          setMarkerRegion(null);
        }
      } finally {
        setLoaderMsg(null);
        setLoading(false);
      }
    })();
  }, [geometry]);

  // ── Reset ────────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setShowOriented(false);
    setOrientStatus('none');
    setOrientMethod(null);
    setAnteriorAngle(0);
    setMarkerRegion(null);
    setStatusMsg('Reset to original');
  }, []);

  // ── Anterior Facing Me ───────────────────────────────────────────────────
  // Reads the camera's current XY angle from the viewport and rotates the
  // oriented mesh around Z so the face toward the camera becomes +X (Anterior).
  const handleAnteriorFacingMe = useCallback(() => {
    if (!viewportRef.current) return;
    const angle = viewportRef.current.getCameraXYAngle();
    setAnteriorAngle(angle);
    setOrientMethod('Auto-PCA + Anterior');
    setStatusMsg('Anterior direction corrected');
  }, []);

  // ── Edit mode ────────────────────────────────────────────────────────────
  const handleEnterEditMode = useCallback(() => {
    if (!geometry) return;
    const baked = bakeGeometry(geometry, transformedPositions);
    setGeometry(baked);
    setShowOriented(false);
    setAnteriorAngle(0);
    setMarkerRegion(null);
    setEditMode(true);
    setUndoStack([]);
    setSelectedFaces(null);
    setHighlightPositions(null);
    setStatusMsg('Edit mode — draw a lasso to select geometry');
  }, [geometry, transformedPositions]);

  const handleFacesSelected = useCallback((faceSet) => {
    if (!geometry || faceSet.size === 0) {
      setSelectedFaces(null);
      setHighlightPositions(null);
      return;
    }
    const pos = geometry.attributes.position.array;
    setSelectedFaces(faceSet);
    setHighlightPositions(buildHighlightPositions(pos, faceSet));
    setStatusMsg(`${faceSet.size.toLocaleString()} faces selected`);
  }, [geometry]);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedFaces || !geometry) return;
    const pos = geometry.attributes.position.array;

    // Push snapshot to undo stack
    setUndoStack(prev => [...prev, new Float32Array(pos)]);

    const newPos = deleteFaces(pos, selectedFaces);
    const newGeo = new THREE.BufferGeometry();
    newGeo.setAttribute('position', new THREE.BufferAttribute(newPos, 3));
    newGeo.computeVertexNormals();

    setGeometry(newGeo);
    setSelectedFaces(null);
    setHighlightPositions(null);
    setStatusMsg(`Deleted ${selectedFaces.size.toLocaleString()} faces`);
  }, [geometry, selectedFaces]);

  const handleUndo = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const stack    = [...prev];
      const snapshot = stack.pop();
      const newGeo   = new THREE.BufferGeometry();
      newGeo.setAttribute('position', new THREE.BufferAttribute(snapshot, 3));
      newGeo.computeVertexNormals();
      setGeometry(newGeo);
      setSelectedFaces(null);
      setHighlightPositions(null);
      setStatusMsg('Undo');
      return stack;
    });
  }, []);

  const handleExitEditMode = useCallback(() => {
    setEditMode(false);
    setSelectedFaces(null);
    setHighlightPositions(null);
    setUndoStack([]);
    setStatusMsg('Edit complete');
  }, []);

  // ── Export ───────────────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    if (!geometry || !orientTransform) return;

    const positions = transformedPositions || geometry.attributes.position.array;
    const exportGeo = new THREE.BufferGeometry();
    exportGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    if (geometry.index) exportGeo.setIndex(geometry.index.clone());
    exportGeo.computeVertexNormals();

    const exporter = new STLExporter();
    const stlString = exporter.parse(new THREE.Mesh(exportGeo));
    const blob = new Blob([stlString], { type: 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const baseName = (fileName || 'mesh').replace(/\.[^.]+$/, '');
    a.download = `${baseName}_oriented.stl`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [geometry, orientTransform, transformedPositions, fileName]);

  return (
    <div id="root">
      <header className="app-header">
        <div className="app-logo">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect x="1" y="1" width="30" height="30" rx="5" stroke="#3af0b0" strokeWidth="2"/>
            <text x="4" y="23" fontFamily="monospace" fontSize="14" fontWeight="700" fill="#3af0b0" letterSpacing="1">LA</text>
          </svg>
        </div>
        <h1 className="app-title">Limb Align</h1>
        <div className="header-badges">
          {fileExt && <span className="badge badge-fmt">{fileExt}</span>}
          {analysis?.vertexCount && (
            <span className="badge badge-info">{analysis.vertexCount.toLocaleString()} verts</span>
          )}
          <span className="badge badge-mode">VIEW</span>
        </div>
      </header>

      <div className="app-body">
        <LeftPanel
          fileName={fileName}
          fileSize={fileSize}
          faceCount={analysis?.faceCount}
          analysis={analysis}
          loading={loading}
          loaderMsg={loaderMsg}
          onAutoOrient={handleAutoOrient}
          onReset={handleReset}
          onAnteriorFacingMe={handleAnteriorFacingMe}
          orientStatus={orientStatus}
          editMode={editMode}
          onEnterEditMode={handleEnterEditMode}
          onDeleteSelected={handleDeleteSelected}
          onUndo={handleUndo}
          onExitEditMode={handleExitEditMode}
          hasSelection={!!selectedFaces && selectedFaces.size > 0}
          canUndo={undoStack.length > 0}
        />

        <Viewport3D
          ref={viewportRef}
          geometry={geometry}
          transformedPositions={transformedPositions}
          wireframe={wireframe}
          resetViewKey={resetViewKey}
          showGrid={showGrid}
          statusMsg={statusMsg}
          markerRegion={markerRegion}
          editMode={editMode}
          highlightPositions={highlightPositions}
          onFacesSelected={handleFacesSelected}
        />

        <RightPanel
          analysis={analysis}
          orientStatus={orientStatus}
          orientMethod={orientMethod}
          onExport={handleExport}
        />
      </div>

      {error && <div className="error-toast">Error: {error}</div>}

      <footer className="app-footer">
        <span>v{version}</span>
        <span className="footer-divider">·</span>
        <span>Updated {__BUILD_DATE__}</span>
      </footer>
    </div>
  );
}
