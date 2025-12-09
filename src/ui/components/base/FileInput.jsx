import styles from "./Form.module.css";

export function FileInput({ label, accept, onChange, helperContent }) {
  return (
    <div className={styles.fieldGroup}>
      <label htmlFor="csvUpload" className={styles.label}>
        {label}
      </label>
      <input
        type="file"
        accept={accept}
        onChange={onChange}
        className={styles.fileInput}
        id="csvUpload"
      />
      {helperContent}
    </div>
  );
}
