import styles from "./ProgressBar.module.css";

export function ProgressBar({ current, total, label }) {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <strong className={styles.label}>{label}</strong>
        <span>
          {current} / {total}
        </span>
      </div>
      <progress value={current} max={total} className={styles.bar} />
    </div>
  );
}
