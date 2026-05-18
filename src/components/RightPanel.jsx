export default function RightPanel({
  analysis,
  orientStatus,
  orientMethod,
  onExport,
}) {
  const conf = analysis?.confidence ?? null;
  const fmtN = (v, d = 1) => v != null ? v.toFixed(d) : '—';

  return (
    <aside className="right-panel">
      {/* Mesh Stats */}
      <div className="panel-section">
        <div className="section-label">Mesh Stats</div>
        {analysis ? (
          <>
            <div className="stat-row">
              <span className="stat-key">Vertices</span>
              <span className="stat-val">{analysis.vertexCount?.toLocaleString() ?? '—'}</span>
            </div>
            <div className="stat-row">
              <span className="stat-key">Faces</span>
              <span className="stat-val">{analysis.faceCount?.toLocaleString() ?? '—'}</span>
            </div>
            <div className="stat-row">
              <span className="stat-key">Bounds X</span>
              <span className="stat-val">{fmtN(analysis.boundsX)} mm</span>
            </div>
            <div className="stat-row">
              <span className="stat-key">Bounds Y</span>
              <span className="stat-val">{fmtN(analysis.boundsY)} mm</span>
            </div>
            <div className="stat-row">
              <span className="stat-key">Bounds Z</span>
              <span className="stat-val">{fmtN(analysis.boundsZ)} mm</span>
            </div>
            <div className="stat-row">
              <span className="stat-key">Volume</span>
              <span className="stat-val">
                {analysis.volumeMm3 != null
                  ? analysis.volumeMm3 >= 1e6
                    ? `${(analysis.volumeMm3 / 1e6).toFixed(1)} mL`
                    : `${Math.round(analysis.volumeMm3).toLocaleString()} mm³`
                  : '—'}
              </span>
            </div>
          </>
        ) : (
          <p className="empty-hint">No file loaded</p>
        )}
      </div>

      {/* Orientation */}
      <div className="panel-section">
        <div className="section-label">Orientation</div>
        <div className="stat-row">
          <span className="stat-key">Status</span>
          <span className={`stat-val ${orientStatus === 'oriented' ? 'stat-accent' : ''}`}>
            {orientStatus === 'oriented' ? 'Oriented' : 'Loaded'}
          </span>
        </div>
        <div className="stat-row">
          <span className="stat-key">Method</span>
          <span className="stat-val">{orientMethod || 'None'}</span>
        </div>
        <div className="stat-row">
          <span className="stat-key">Long axis</span>
          <span className="stat-val">{orientStatus === 'oriented' ? 'Z+' : '—'}</span>
        </div>
        <div className="stat-row">
          <span className="stat-key">Distal pt</span>
          <span className="stat-val" style={{ fontSize: '0.68rem' }}>
            {orientStatus === 'oriented' ? '(0, 0, 0)' : '—'}
          </span>
        </div>
        {conf != null && (
          <>
            <div className="stat-row" style={{ marginTop: 6 }}>
              <span className="stat-key">Confidence</span>
              <span className="stat-val stat-accent">{conf}%</span>
            </div>
            <div className="confidence-bar">
              <div
                className="confidence-fill"
                style={{ width: `${conf}%` }}
              />
            </div>
          </>
        )}
      </div>

      {/* Axis Convention */}
      <div className="panel-section">
        <div className="section-label">Axis Convention</div>
        <div className="axis-row">
          <span className="axis-swatch axis-x" />
          <span className="stat-key">X+</span>
          <span className="stat-val">Anterior</span>
        </div>
        <div className="axis-row">
          <span className="axis-swatch axis-y" />
          <span className="stat-key">Y+</span>
          <span className="stat-val">Medial</span>
        </div>
        <div className="axis-row">
          <span className="axis-swatch axis-z" />
          <span className="stat-key">Z+</span>
          <span className="stat-val">Proximal (up)</span>
        </div>
        <div className="axis-row">
          <span className="axis-swatch axis-o" />
          <span className="stat-key">Origin</span>
          <span className="stat-val">Distal tip</span>
        </div>
      </div>

      {/* Export */}
      <div className="panel-section">
        <div className="section-label">Export</div>
        <button className="btn btn-primary" disabled={!analysis} onClick={onExport}>
          Download STL
        </button>
      </div>
    </aside>
  );
}
