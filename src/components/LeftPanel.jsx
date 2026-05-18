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

  const handleFile = (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['stl', 'obj'].includes(ext)) {
      alert('Please upload an STL or OBJ file.');
      return;
    }
    if (LeftPanel._onFile) LeftPanel._onFile(file);
  };

  return (
    <aside className="left-panel">
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
    </aside>
  );
}
