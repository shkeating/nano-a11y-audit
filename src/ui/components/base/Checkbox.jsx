import styles from "./Form.module.css";

export function Checkbox({ checked, onChange, label, description }) {
  return (
    <div className={styles.fieldGroup}>
      <label className={styles.checkboxLabel}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className={styles.checkboxInput}
        />
        {label}
      </label>
      {description && (
        <small className={styles.helperText}>{description}</small>
      )}
    </div>
  );
}
