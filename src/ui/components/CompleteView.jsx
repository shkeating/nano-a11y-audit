// src/ui/components/CompleteView.jsx
import { useMemo } from "preact/hooks";
import { Button } from "./base/Button";
import { generateCSV, downloadCSV } from "../../utils/csv-exporter"; // <--- 1. IMPORT
import styles from "./CompleteView.module.css";

export function CompleteView({
  summary,
  results = [],
  onImport,
  onDownload,
  onStartNew,
}) {
  const stats = [
    { label: "Passed", value: summary.passed, color: "#28a745" },
    { label: "Failed", value: summary.failed, color: "#dc3545" },
    { label: "Cannot tell", value: summary.cantTell, color: "#ffc107" },
    { label: "Not present", value: summary.inapplicable, color: "#6c757d" },
    { label: "Not checked", value: summary.untested, color: "#6c757d" },
  ];

  // Group failures by Criteria ID
  const failureGroups = useMemo(() => {
    const groups = {};
    results.forEach((r) => {
      if (r.verdict === "FAIL") {
        if (!groups[r.earlId]) {
          groups[r.earlId] = [];
        }
        groups[r.earlId].push(r);
      }
    });
    return groups;
  }, [results]);

  const hasFailures = Object.keys(failureGroups).length > 0;

  // --- 2. ADD HANDLER ---
  const handleExportCSV = () => {
    const csvData = generateCSV(results);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    downloadCSV(csvData, `nano-audit-data-${timestamp}.csv`);
  };

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

      {hasFailures && (
        <div className={styles.failureSection}>
          <h4>Failure Breakdown</h4>
          {Object.entries(failureGroups).map(([id, items]) => (
            <details key={id} className={styles.failureGroup}>
              <summary className={styles.summaryHeader}>
                <strong>{id}</strong>
                <span className={styles.badge}>{items.length}</span>
              </summary>
              <div className={styles.failureList}>
                {items.map((item, idx) => (
                  <div key={idx} className={styles.failureItem}>
                    <div className={styles.url}>
                      <strong>Page:</strong> {item.url}
                    </div>
                    <pre className={styles.reason}>{item.reason}</pre>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}

      <div className={styles.actions}>
        <Button onClick={onImport} className={styles.importButton}>
          Import to WCAG EM Tool
        </Button>

        <div className="grid">
          <Button variant="secondary" outline onClick={onDownload}>
            Download JSON
          </Button>
          {/* --- 3. ADD BUTTON --- */}
          <Button variant="secondary" outline onClick={handleExportCSV}>
            Export CSV
          </Button>
          <Button variant="contrast" outline onClick={onStartNew}>
            Start New
          </Button>
        </div>
      </div>
    </div>
  );
}
