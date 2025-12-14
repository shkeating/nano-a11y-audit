import { useMemo } from "preact/hooks";
import { Button } from "./base/Button";
import { generateCSV, downloadCSV } from "../../utils/csv-exporter";
import styles from "./CompleteView.module.css";

export function CompleteView({
  summary,
  results = [],
  pageTimings = [],
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
            <details key={id} className={styles.groupDetails}>
              <summary className={styles.groupSummary}>
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
          <Button variant="secondary" outline onClick={handleExportCSV}>
            Export CSV
          </Button>
          <Button variant="contrast" outline onClick={onStartNew}>
            Start New
          </Button>
        </div>
      </div>

      {/* --- Performance Metrics --- */}

      {/* --- Timing Breakdown Details --- */}
      {pageTimings.length > 0 && (
        <details className={styles.groupDetails}>
          <summary className={styles.groupSummary}>
            <strong>Performance Breakdown</strong>
            <span className={styles.badge} style={{ backgroundColor: "#555" }}>
              {pageTimings.length} Pages
            </span>
          </summary>
          <div className={styles.failureList}>
            <table className={styles.timingTable}>
              <thead>
                <tr>
                  <th>URL</th>
                  <th style={{ textAlign: "right" }}>Duration</th>
                </tr>
              </thead>
              <tbody>
                {pageTimings.map((t, idx) => (
                  <tr key={idx}>
                    <td className={styles.urlCell}>{t.url}</td>
                    <td className={styles.timeCell}>{t.duration}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      <div className={styles.perfContainer}>
        <div className={styles.perfStat}>
          <span className={styles.perfLabel}>Avg. Time per Page:</span>
          <span className={styles.perfValue}>
            {summary.averageDuration || 0}ms
          </span>
        </div>
      </div>
    </div>
  );
}
