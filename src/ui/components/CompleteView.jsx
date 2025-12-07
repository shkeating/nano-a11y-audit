import { Button } from "./base/Button";

export function CompleteView({ onDownloadAgain, onStartNew }) {
  return (
    <div
      className="complete-box"
      style={{ textAlign: "center", marginTop: "2rem" }}
    >
      <h3>Audit Completed</h3>
      <p>The report has been downloaded and the W3C Tool opened.</p>
      <div className="grid">
        <Button variant="contrast" onClick={onDownloadAgain}>
          Download Report Again
        </Button>
        <Button onClick={onStartNew}>Start New Audit</Button>
      </div>
    </div>
  );
}
