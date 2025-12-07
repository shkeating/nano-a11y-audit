// src/ui/components/SetupView.jsx

export function SetupView({
  onFileUpload,
  onOpenSettings,
  onStartAudit,
  urlCount,
}) {
  return (
    <div id="setup">
      <h3>Getting Started</h3>
      <p className="instruction-text">
        Upload a CSV of URLs to begin the hybrid audit.
      </p>

      <div className="flex">
        <section style={{ width: "100%" }}>
          <h3>Test Sample</h3>
          <label htmlFor="csvFile">Load URLs (CSV):</label>
          <input
            type="file"
            id="csvFile"
            accept=".csv"
            onChange={onFileUpload}
          />
          {urlCount > 0 && (
            <small
              style={{ color: "green", display: "block", marginTop: "5px" }}
            >
              ✅ {urlCount} URLs loaded ready for testing.
            </small>
          )}
        </section>
      </div>

      <div className="grid" style={{ marginTop: "20px" }}>
        <button className="secondary outline" onClick={onOpenSettings}>
          Configure Settings
        </button>
        <button onClick={onStartAudit}>Start Batch Audit</button>
      </div>
    </div>
  );
}
