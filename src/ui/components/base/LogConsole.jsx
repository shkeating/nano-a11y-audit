import { useEffect, useRef } from "preact/hooks";
import styles from "./LogConsole.module.css";

export function LogConsole({ logs, className = "" }) {
  const endRef = useRef(null);

  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  return (
    <section
      role="log"
      aria-live="polite"
      className={`${styles.logArea} ${className}`}
    >
      {logs.map((msg, i) => (
        <div key={i} className={styles.entry}>
          {msg}
        </div>
      ))}
      <div ref={endRef} />
    </section>
  );
}
