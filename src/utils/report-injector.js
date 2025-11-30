
/**
 * This function is intended to be injected into the W3C Report Tool page.
 * It simulates a file upload to populate the tool with the generated EARL report.
 *
 * @param {Object} reportData - The JSON object containing the EARL report.
 */
export function injectReportFunction(reportData) {
  console.log("Nano A11y Auditor: Injector script running...");

  // Select the element next to the hidden input/control, which acts as the visible button
  const inputElement = document.getElementById("evaluation_open");
  if (!inputElement) {
      console.warn("Nano A11y Auditor: Could not find 'Open Report' input (id=evaluation_open).");
      return;
  }
  const openButton = inputElement.nextElementSibling;
  if (!openButton) {
    console.warn("Nano A11y Auditor: Could not find 'Open Report' button (nextElementSibling of id=evaluation_open).");
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
