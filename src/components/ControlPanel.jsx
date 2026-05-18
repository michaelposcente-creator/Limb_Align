export default function ControlPanel({
  fileName,
  analysis,
  landmarks,
  pickMode,
  onPickMode,
  onClearLandmarks,
  onExport,
  onAutoOrient,
  wireframe,
  onWireframe,
  showOriented,
  onShowOriented,
  loading,
}) {
  const conf = analysis?.confidence ?? null;
  const confColor = conf == null ? '#546e7a' : conf >= 70 ? '#66bb6a' : conf >= 40 ? '#ffa726' : '#ef5350';

  return (
    <aside className="control-panel">
      {/* File info */}
      <div className="panel-section">
        <h3>File</h3>
        {fileName ? (
          <div className="stat-row">
            <span className="stat-label">Loaded</span>
            <span className="stat-value" style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</span>
          </div>
        ) : (
          <p style={{ fontSize: '0.75rem', color: '#546e7a' }}>No file loaded</p>
        )}
        {loading && <p style={{ fontSize: '0.75rem', color: '#4fc3f7', marginTop: 6 }}>Processing…</p>}
      </div>

      {/* Analysis stats */}
      <div className="panel-section">
        <h3>Analysis</h3>
        {analysis ? (
          <>
            <div className="stat-row">
              <span className="stat-label">Vertices</span>
              <span className="stat-value">{analysis.vertexCount?.toLocaleString()}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Est. length</span>
              <span className="stat-value">{analysis.limbLength?.toFixed(1)} mm</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Elongation</span>
              <span className="stat-value">{analysis.eigenRatio?.toFixed(2)}</span>
            </div>
            <div className="stat-row" style={{ marginTop: 6 }}>
              <span className="stat-label">Distal confidence</span>
              <span className="stat-value" style={{ color: confColor }}>{conf}%</span>
            </div>
            <div className="confidence-bar">
              <div
                className="confidence-fill"
                style={{ width: `${conf}%`, background: confColor }}
              />
            </div>
            {conf < 50 && (
              <p style={{ fontSize: '0.7rem', color: '#ffa726', marginTop: 6 }}>
                Low confidence — consider picking landmarks manually.
              </p>
            )}
          </>
        ) : (
          <p style={{ fontSize: '0.75rem', color: '#546e7a' }}>Load a file to analyze</p>
        )}
      </div>

      {/* Orientation actions */}
      <div className="panel-section">
        <h3>Auto-Orient</h3>
        <button className="btn btn-primary" disabled={!analysis || loading} onClick={onAutoOrient}>
          Run Auto-Orient
        </button>
        <div className="toggle-row" style={{ marginTop: 10 }}>
          <span className="toggle-label">Show oriented</span>
          <label className="toggle">
            <input type="checkbox" checked={showOriented} onChange={e => onShowOriented(e.target.checked)} disabled={!analysis} />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      {/* Manual landmarks */}
      <div className="panel-section">
        <h3>Manual Landmarks</h3>
        <div className="info-box" style={{ marginBottom: 10 }}>
          Click a pick button, then click a point on the mesh to define that landmark. Landmarks override auto-detection.
        </div>

        <div className="landmark-row">
          <div className={`landmark-dot ${landmarks.distal ? 'distal' : 'empty'}`} />
          <span className="landmark-label">Distal tip</span>
          <span className="landmark-status">{landmarks.distal ? '✓' : '—'}</span>
        </div>
        <button
          className={`btn btn-warning ${pickMode === 'distal' ? 'active' : ''}`}
          disabled={!analysis}
          onClick={() => onPickMode(pickMode === 'distal' ? 'none' : 'distal')}
        >
          {pickMode === 'distal' ? '⬡ Cancel (click mesh)' : 'Pick Distal Tip'}
        </button>

        {(landmarks.distal) && (
          <button className="btn btn-danger" style={{ marginTop: 8 }} onClick={onClearLandmarks}>
            Clear Landmarks
          </button>
        )}
      </div>

      {/* Display */}
      <div className="panel-section">
        <h3>Display</h3>
        <div className="toggle-row">
          <span className="toggle-label">Wireframe</span>
          <label className="toggle">
            <input type="checkbox" checked={wireframe} onChange={e => onWireframe(e.target.checked)} />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      {/* Export */}
      <div className="panel-section">
        <h3>Export</h3>
        <button className="btn btn-success" disabled={!analysis} onClick={onExport}>
          Export Oriented STL
        </button>
      </div>
    </aside>
  );
}
