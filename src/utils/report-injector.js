/**
 * Injects report data into the W3C Report Tool.
 * Uses robust polling to handle SPA loading times.
 */
export function injectReportFunction(reportData) {
  console.log("Nano A11y Auditor: Injector script running...");

  const MAX_ATTEMPTS = 20;
  let attempts = 0;

  // POLL: Search directly for the file input (Bypassing the UI button click)
  const inputInterval = setInterval(() => {
    attempts++;

    // Strategy A: ID (Standard in W3C tool)
    let fileInput = document.getElementById("evaluation_open");

    // Strategy B: Generic Fallback (Find the first file input on the page)
    if (!fileInput) {
      fileInput = document.querySelector('input[type="file"]');
    }

    if (fileInput) {
      clearInterval(inputInterval);
      console.log("Nano A11y Auditor: File input found. Uploading...");

      try {
        // 1. Create the File object
        const jsonString = JSON.stringify(reportData, null, 2);
        const file = new File([jsonString], "nano-audit-report.json", {
          type: "application/json",
        });

        // 2. Assign to Input via DataTransfer
        // This programmatically sets the file without user interaction
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;

        // 3. Trigger Change Event (This tells the W3C app to read the file)
        // We do NOT call .click() here, so no dialog will appear.
        fileInput.dispatchEvent(new Event("change", { bubbles: true }));

        console.log("Nano A11y Auditor: Success!");
        navigateToViewReport();
      } catch (err) {
        console.error("Nano A11y Auditor: Injection Error", err);
      }
    } else if (attempts >= MAX_ATTEMPTS) {
      clearInterval(inputInterval);
      console.error("Nano A11y Auditor: Timed out waiting for file input.");
    }
  }, 500);

  function navigateToViewReport() {
    setTimeout(() => {
      console.log("Nano A11y Auditor: Navigating to View Report...");
      // Try finding the 'View Report' button/link
      let viewBtn = document.querySelector('a[href*="view-report"]');

      if (!viewBtn) {
        // Fallback text search
        viewBtn = Array.from(document.querySelectorAll("a, button")).find(
          (el) =>
            el.innerText && el.innerText.trim().toLowerCase() === "view report"
        );
      }

      if (viewBtn) {
        viewBtn.click();
      } else {
        console.warn(
          "Nano A11y Auditor: Could not auto-navigate to View Report."
        );
      }
    }, 2500);
  }
}
