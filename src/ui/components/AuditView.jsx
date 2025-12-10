import { ProgressBar } from "./base/ProgressBar";
import { LogConsole } from "./base/LogConsole";
import styles from "./AuditView.module.css";

export function AuditView({ enableMultimodal, progress, logs }) {
  return (
    <div id="auditView">
      {enableMultimodal && (
        <div className={styles.warningBox}>
          <strong>IMPORTANT: Keep Window Focused</strong>
          <p className={styles.warningText}>
            Visual checks require the page to be visible on screen. Do not
            minimize.
          </p>
        </div>
      )}

      <div className={styles.statusBox}>
        <h3>Audit Status</h3>

        <ProgressBar
          current={progress.current}
          total={progress.total}
          label="Progress"
        />

        <div className={styles.currentUrl}>
          <strong>Current:</strong> <span>{progress.currentUrl}</span>
        </div>

        <LogConsole logs={logs} />
      </div>
    </div>
  );
}
