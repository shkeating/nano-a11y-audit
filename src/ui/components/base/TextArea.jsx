import styles from "./Form.module.css";

export function TextArea({
  label,
  value,
  onInput,
  rows = 4,
  description,
  taid = "textarea-id",
}) {
  return (
    <div className={styles.fieldGroup}>
      <label htmlFor={taid} className={styles.label}>
        {label}
      </label>
      {description && (
        <small className={styles.helperText}>{description}</small>
      )}
      <textarea
        rows={rows}
        className={styles.textarea}
        value={value}
        onInput={onInput}
        id={taid}
      />
    </div>
  );
}
