export function ProgressBar({ current, total, label }) {
  return (
    <div className="progress-container" style={{ marginBottom: "1rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "5px",
        }}
      >
        <strong>{label}</strong>
        <span>
          {current} / {total}
        </span>
      </div>
      <progress value={current} max={total} style={{ width: "100%" }} />
    </div>
  );
}
