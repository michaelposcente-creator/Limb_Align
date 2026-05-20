import { useRef, useState } from 'react';

export default function LeftPanel({
  fileName,
  fileSize,
  faceCount,
  analysis,
  loading,
  loaderMsg,
  onAutoOrient,
  onReset,
  onAnteriorFacingMe,
  wireframe,
  onWireframe,
  showGrid,
  onShowGrid,
}) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  const handleFile = (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['stl', 'obj'].includes(ext)) {
      alert('Please upload an STL or OBJ file.');
      return;
    }
    if (LeftPanel._onFile) LeftPanel._onFile(file);
  };

  const markerHref = 'https://raw.githubusercontent.com/michaelposcente-creator/Limb_Align/main/public/marker.stl';

  return (
    <aside className="left-panel">

      {/* Instructions button */}
      <div className="panel-section" style={{ paddingBottom: 10 }}>
        <button className="btn btn-secondary" onClick={() => setShowInstructions(true)}>
          How to Use / Demo
        </button>
      </div>

      {/* Marker download */}
      <div className="panel-section">
        <div className="section-label">Scan Marker</div>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 10, lineHeight: 1.5 }}>
          Print and attach this marker to the patient before scanning.
        </p>
        <a className="btn btn-secondary" href={markerHref} download="limb-align-marker.stl"
          style={{ textAlign: 'center', textDecoration: 'none', display: 'block' }}>
          Download Marker STL
        </a>
      </div>

      {/* Scan File */}
      <div className="panel-section">
        <div className="section-label">Scan File</div>
        {!fileName ? (
          <div
            className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
            onClick={() => inputRef.current.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
          >
            <div className="upload-icon-lg">↑</div>
            <p className="upload-hint">Drop file or click to browse</p>
            <p className="upload-formats">STL · OBJ</p>
            <input ref={inputRef} type="file" accept=".stl,.obj" style={{ display: 'none' }}
              onChange={(e) => handleFile(e.target.files[0])} />
          </div>
        ) : (
          <div className="file-loaded-info">
            <div className="file-loaded-name">{fileName}</div>
            <div className="file-loaded-meta">
              {fileSize && <span>{fileSize}</span>}
              {faceCount != null && <span>{faceCount.toLocaleString()} faces</span>}
            </div>
            <div className="upload-zone upload-zone-sm" onClick={() => inputRef.current.click()} style={{ marginTop: 8 }}>
              <span className="upload-hint-sm">Load different file</span>
              <input ref={inputRef} type="file" accept=".stl,.obj" style={{ display: 'none' }}
                onChange={(e) => handleFile(e.target.files[0])} />
            </div>
          </div>
        )}
        {loading && !loaderMsg && <p className="loading-text">Processing…</p>}
      </div>

      {/* Auto Orientation */}
      <div className="panel-section">
        <div className="section-label">Auto Orientation</div>
        {loaderMsg ? (
          <div className="loader-stages">
            <div className="loader-spinner" />
            <span className="loader-stage-text">{loaderMsg}</span>
          </div>
        ) : (
          <>
            <button className="btn btn-primary" disabled={!analysis || loading} onClick={onAutoOrient}>
              Auto-Orient Scan
            </button>
            <button className="btn btn-secondary" disabled={!analysis} onClick={onReset} style={{ marginTop: 6 }}>
              Reset to Original
            </button>
          </>
        )}
      </div>

      {/* Anterior Correction */}
      <div className="panel-section">
        <div className="section-label">Anterior Correction</div>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 10, lineHeight: 1.5 }}>
          Rotate the limb so the anterior face is pointing toward you, then click the button below.
        </p>
        <button
          className="btn btn-primary"
          disabled={!analysis}
          onClick={onAnteriorFacingMe}
        >
          Anterior Facing Me
        </button>
      </div>

      {/* Display */}
      <div className="panel-section">
        <div className="section-label">Display</div>
        <div className="toggle-row">
          <span className="toggle-label">Wireframe</span>
          <label className="toggle">
            <input type="checkbox" checked={wireframe} onChange={e => onWireframe(e.target.checked)} />
            <span className="toggle-slider" />
          </label>
        </div>
        <div className="toggle-row">
          <span className="toggle-label">Grid floor</span>
          <label className="toggle">
            <input type="checkbox" checked={showGrid} onChange={e => onShowGrid(e.target.checked)} />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>
      {/* Instructions modal */}
      {showInstructions && (
        <div className="modal-overlay" onClick={() => setShowInstructions(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">How to Use Limb Align</span>
              <button className="modal-close" onClick={() => setShowInstructions(false)}>✕</button>
            </div>
            <div className="modal-body">
              <ol className="instructions-list">
                <li>
                  <strong>Download & print the marker</strong> — use the Download Marker STL button and attach it to the patient at a known anatomical landmark before scanning.
                </li>
                <li>
                  <strong>Scan the limb</strong> — capture the scan with the marker visible. Export as STL or OBJ.
                </li>
                <li>
                  <strong>Load the scan</strong> — drag and drop your file into the Scan File area, or click to browse.
                </li>
                <li>
                  <strong>Auto-Orient</strong> — click Auto-Orient Scan to align the limb along the standard anatomical axes.
                </li>
                <li>
                  <strong>Anterior Correction</strong> — rotate the view so the anterior face points toward you, then click Anterior Facing Me.
                </li>
                <li>
                  <strong>Export</strong> — download the oriented scan as an STL from the right panel.
                </li>
              </ol>
            </div>
          </div>
        </div>
      )}

    </aside>
  );
}
