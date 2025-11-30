/**
 * Injects report data into the W3C Report Tool.
 * Uses robust polling to handle SPA loading times.
 */
export function injectReportFunction(reportData) {
  console.log("Nano A11y Auditor: Injector script running...");

  const MAX_ATTEMPTS = 20;
  let setupAttempts = 0;

  // POLL 1: Find the "Open Report" Button (Handles App Boot Delay)
  const setupInterval = setInterval(() => {
    setupAttempts++;

    // Strategy A: Semantic Label (Best)
    let openButton = document.querySelector('label[for="evaluation_open"]');

    // Strategy B: Visible Text (Fallback)
    if (!openButton) {
      const candidates = Array.from(
        document.querySelectorAll("button, label, a")
      );
      openButton = candidates.find(
        (el) => el.innerText && el.innerText.trim().includes("Open Report")
      );
    }

    // Strategy C: Legacy Sibling
    if (!openButton) {
      const input = document.getElementById("evaluation_open");
      if (input) openButton = input.nextElementSibling;
    }

    if (openButton) {
      clearInterval(setupInterval);
      openButton.click();
      console.log(
        "Nano A11y Auditor: 'Open Report' clicked. Waiting for file input..."
      );
      waitForFileInput(); // Proceed to next step
    } else if (setupAttempts >= MAX_ATTEMPTS) {
      clearInterval(setupInterval);
      console.error(
        "Nano A11y Auditor: Timed out finding 'Open Report' button."
      );
    }
  }, 500);

  function waitForFileInput() {
    let inputAttempts = 0;
    const inputInterval = setInterval(() => {
      inputAttempts++;
      const fileInput = document.querySelector('input[type="file"]');

      if (fileInput) {
        clearInterval(inputInterval);
        console.log("Nano A11y Auditor: File input found. Uploading...");

        // Inject Data
        const jsonString = JSON.stringify(reportData, null, 2);
        const file = new File([jsonString], "nano-audit-report.json", {
          type: "application/json",
        });
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;
        fileInput.dispatchEvent(new Event("change", { bubbles: true }));

        console.log("Nano A11y Auditor: Success!");
        navigateToViewReport(); // Proceed to final step
      } else if (inputAttempts >= MAX_ATTEMPTS) {
        clearInterval(inputInterval);
        console.error("Nano A11y Auditor: Timed out waiting for file input.");
      }
    }, 500);
  }

  function navigateToViewReport() {
    setTimeout(() => {
      console.log("Nano A11y Auditor: Navigating to View Report...");
      let viewBtn = document.querySelector('a[href*="view-report"]');

      if (!viewBtn) {
        viewBtn = Array.from(document.querySelectorAll("a, button")).find(
          (el) =>
            el.innerText && el.innerText.trim().toLowerCase() === "view report"
        );
      }

      if (viewBtn) viewBtn.click();
      else
        console.warn(
          "Nano A11y Auditor: Could not auto-navigate to View Report."
        );
    }, 2500);
  }
}
