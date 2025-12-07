import { ProgressBar } from "./base/ProgressBar";
import { LogConsole } from "./base/LogConsole";

export function AuditView({ enableMultimodal, progress, logs }) {
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

        <ProgressBar
          current={progress.current}
          total={progress.total}
          label="Progress"
        />

        <div className="status-current-url" style={{ marginBottom: "10px" }}>
          <strong>Current:</strong> <span>{progress.currentUrl}</span>
        </div>

        <LogConsole logs={logs} />
      </div>
    </div>
  );
}
