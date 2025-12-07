// src/ui/components/CompleteView.jsx

export function CompleteView({ onDownloadAgain, onStartNew }) {
  return (
    <div
      className="complete-box"
      style={{ textAlign: "center", marginTop: "2rem" }}
    >
      <h3>Audit Completed</h3>
      <p>The report has been downloaded and the W3C Tool opened.</p>
      <div className="grid">
        <button className="contrast" onClick={onDownloadAgain}>
          Download Report Again
        </button>
        <button onClick={onStartNew}>Start New Audit</button>
      </div>
    </div>
  );
}
