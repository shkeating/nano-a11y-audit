import { Button } from "./base/Button";
import styles from "./CompleteView.module.css";

export function CompleteView({ summary, onImport, onDownload, onStartNew }) {
  const stats = [
    { label: "Passed", value: summary.passed, color: "#28a745" },
    { label: "Failed", value: summary.failed, color: "#dc3545" },
    { label: "Cannot tell", value: summary.cantTell, color: "#ffc107" },
    { label: "Not present", value: summary.inapplicable, color: "#6c757d" },
    { label: "Not checked", value: summary.untested, color: "#6c757d" },
  ];

  return (
    <div className={styles.container}>
      <h3 className={styles.heading}>Audit Summary</h3>
      <p className={styles.metaText}>
        Reported on {summary.totalCriteria} WCAG 2.2 AA Success Criteria.
      </p>

      <div className={styles.summaryGrid}>
        {stats.map((stat) => (
          <div key={stat.label} className={styles.statCard}>
            <span className={styles.number} style={{ color: stat.color }}>
              {stat.value}
            </span>
            <span className={styles.label}>{stat.label}</span>
          </div>
        ))}
      </div>

      <div className={styles.actions}>
        <Button onClick={onImport} className={styles.importButton}>
          Import to WCAG EM Tool
        </Button>

        <div className="grid">
          <Button variant="secondary" outline onClick={onDownload}>
            Download JSON
          </Button>
          <Button variant="contrast" outline onClick={onStartNew}>
            Start New
          </Button>
        </div>
      </div>
    </div>
  );
}
