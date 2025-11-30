
console.log("Nano A11y Auditor: Report Injector Loaded");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.earlReport) {
    console.log("Received EARL report, attempting injection...", message.earlReport);
    injectReport(message.earlReport);
    // Send response to confirm receipt
    sendResponse({ status: "received" });
  }
});

function injectReport(reportData) {
  const openButton = document.getElementById("evaluation_open");
  if (!openButton) {
    console.warn("Nano A11y Auditor: Could not find 'Open Report' button (id=evaluation_open).");
    return;
  }

  openButton.click();
  console.log("Nano A11y Auditor: Clicked 'Open Report'. Waiting for file input...");

  // Poll for the file input since it appears in a modal
  const maxAttempts = 20;
  let attempts = 0;

  const intervalId = setInterval(() => {
    attempts++;
    // Look for an input of type file.
    const fileInput = document.querySelector('input[type="file"]');

    if (fileInput) {
      clearInterval(intervalId);
      console.log("Nano A11y Auditor: Found file input. Injecting data...");

      const jsonString = JSON.stringify(reportData, null, 2);
      const file = new File([jsonString], "nano-audit-report.json", {
        type: "application/json",
      });

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileInput.files = dataTransfer.files;

      // Dispatch change event to trigger the tool's import logic
      const changeEvent = new Event("change", { bubbles: true });
      fileInput.dispatchEvent(changeEvent);

      console.log("Nano A11y Auditor: Report injected successfully.");
    } else if (attempts >= maxAttempts) {
      clearInterval(intervalId);
      console.error("Nano A11y Auditor: Timed out waiting for file input.");
    }
  }, 500);
}
