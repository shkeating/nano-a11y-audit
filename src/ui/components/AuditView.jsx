// src/ui/components/AuditView.jsx

export function AuditView({ enableMultimodal, progress, logs, logEndRef }) {
  return (
    <div id="auditView">
      {enableMultimodal && (
        <div className="warning-box">
          <strong>IMPORTANT: Keep Window Focused</strong>
          <p style={{ marginBottom: 0, fontSize: "0.9em" }}>
            Visual checks require the page to be visible on screen. Do not
            minimize.
          </p>
        </div>
      )}

      <div className="status-box">
        <h3>Audit Status</h3>
        <div>
          <strong>Progress:</strong> {progress.current}/{progress.total}
        </div>
        <progress
          value={progress.current}
          max={progress.total}
          style={{ width: "100%" }}
        ></progress>
        <div className="status-current-url">
          <strong>Current:</strong> <span>{progress.currentUrl}</span>
        </div>

        <section id="log" role="log" aria-live="polite">
          {logs.map((msg, i) => (
            <div key={i} className="log-entry">
              {msg}
            </div>
          ))}
          <div ref={logEndRef} />
        </section>
      </div>
    </div>
  );
}
