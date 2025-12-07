import styles from "./Modal.module.css";

export function Modal({ isOpen, onClose, title, children, footer }) {
  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <dialog open onClick={handleBackdropClick}>
      <article>
        <header className={styles.header}>
          <h3>{title}</h3>
          <button
            aria-label="Close"
            className="close"
            onClick={onClose}
          ></button>
        </header>

        {children}

        {footer && <footer>{footer}</footer>}
      </article>
    </dialog>
  );
}
