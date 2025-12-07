import styles from "./Form.module.css";

export function TextArea({ label, value, onInput, rows = 4, description }) {
  return (
    <div className={styles.fieldGroup}>
      <label className={styles.label}>{label}</label>
      {description && (
        <small className={styles.helperText}>{description}</small>
      )}
      <textarea
        rows={rows}
        className={styles.textarea}
        value={value}
        onInput={onInput}
      />
    </div>
  );
}
