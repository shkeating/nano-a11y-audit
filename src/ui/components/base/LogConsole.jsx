import { useEffect, useRef } from "preact/hooks";

export function LogConsole({ logs, className = "" }) {
  const endRef = useRef(null);

  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  return (
    <section
      id="log"
      role="log"
      aria-live="polite"
      className={`log-area ${className}`}
      style={{
        height: "200px",
        overflowY: "auto",
        padding: "10px",
        border: "1px solid #ccc",
        borderRadius: "4px",
        backgroundColor: "#f8f9fa",
        fontFamily: "monospace",
        fontSize: "0.9em",
      }}
    >
      {logs.map((msg, i) => (
        <div key={i} className="log-entry" style={{ marginBottom: "4px" }}>
          {msg}
        </div>
      ))}
      <div ref={endRef} />
    </section>
  );
}
