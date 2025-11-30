/**
 * This function is intended to be injected into the W3C Report Tool page.
 * It simulates a file upload to populate the tool with the generated EARL report.
 *
 * @param {Object} reportData - The JSON object containing the EARL report.
 */
export function injectReportFunction(reportData) {
  console.log("Nano A11y Auditor: Injector script running...");

  // STRATEGY 1: Semantic Label Lookup (Most Reliable)
  let openButton = document.querySelector('label[for="evaluation_open"]');

  // STRATEGY 2: Text Content Lookup (Fallback)
  if (!openButton) {
    const candidates = Array.from(
      document.querySelectorAll("button, label, a.btn")
    );
    openButton = candidates.find(
      (el) => el.innerText && el.innerText.trim().includes("Open Report")
    );
  }

  // STRATEGY 3: Legacy Sibling Lookup (Last Resort)
  if (!openButton) {
    const inputElement = document.getElementById("evaluation_open");
    if (inputElement) {
      openButton = inputElement.nextElementSibling;
    }
  }

  // Final Check
  if (!openButton) {
    console.warn(
      "Nano A11y Auditor: Could not find 'Open Report' button via any strategy."
    );
    console.warn(
      "Debug info: Available buttons ->",
      Array.from(document.querySelectorAll("button, label")).map(
        (b) => b.innerText
      )
    );
    return;
  }

  openButton.click();
  console.log(
    "Nano A11y Auditor: Clicked 'Open Report'. Waiting for file input..."
  );

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

      // --- NAVIGATE TO VIEW REPORT (SPA SAFE WAY) ---
      setTimeout(() => {
        console.log(
          "Nano A11y Auditor: searching for 'View Report' navigation link..."
        );

        // 1. Try finding the specific link by its partial href (common in SPAs)
        let viewBtn = document.querySelector('a[href*="view-report"]');

        // 2. Fallback: Search by text content "View Report"
        if (!viewBtn) {
          const allLinks = Array.from(document.querySelectorAll("a, button"));
          viewBtn = allLinks.find(
            (el) =>
              el.innerText &&
              el.innerText.trim().toLowerCase() === "view report"
          );
        }

        if (viewBtn) {
          console.log("Nano A11y Auditor: Clicking 'View Report'...");
          viewBtn.click();
        } else {
          console.error(
            "Nano A11y Auditor: Could not find 'View Report' button. Please manually click 'View Report'."
          );
        }
      }, 2500); // Slight delay to ensure the tool processes the JSON import first
    } else if (attempts >= maxAttempts) {
      clearInterval(intervalId);
      console.error("Nano A11y Auditor: Timed out waiting for file input.");
    }
  }, 500);
}
