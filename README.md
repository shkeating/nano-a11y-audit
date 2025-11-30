# Gemini Nano A11y Auditor

**Browser-Native Accessibility Testing with On-Device Generative AI**

- **Author:** Shauna Keating
- **Course:** HCI 550 | Project I
- **Status:** Research Prototype (v0.1)

## 📋 Overview

This project is a Chrome Extension that leverages the experimental **Chrome Prompt API (`ai.languageModel`)** to perform automated accessibility auditing directly within the browser.

Unlike traditional AI auditing tools that rely on cloud APIs (sending DOM data to external servers), this tool uses **Gemini Nano**, a Small Language Model (SLM) embedded locally in Chrome. This architecture ensures **zero latency, zero cost, and 100% data privacy**.

### Key Capabilities

- **Batch Processing:** Accepts a CSV of URLs and automatically navigates the browser to test them sequentially.
- **Structured Context Extraction:** Injects JavaScript to extract the "Computed Accessibility Tree" (DOM + CSS styles) rather than raw HTML.
- **On-Device Inference:** Uses Gemini Nano to reason about visual criteria (currently piloting **WCAG 1.4.1 Use of Color**) without internet access.
- **Interoperable Reporting:** Generates JSON-LD reports compliant with the **W3C EARL standard**, ready for import into the [WCAG-EM Report Tool](https://www.w3.org/WAI/eval/report-tool/).

---

## 🛠️ Technical Architecture

The tool utilizes a **Side Panel Controller** architecture:

1.  **The Controller (`sidepanel.js`):** Maintains state, manages the URL queue, and orchestrates the audit loop.
2.  **The Extractor:** A content script injected into the active tab to scrape computed styles (e.g., `text-decoration`, `border-bottom`).
3.  **The Auditor:** Passes the structured data to `window.ai.languageModel` with a system prompt optimized for SLM instruction following.

---

## ⚙️ Prerequisites (Crucial)

This extension relies on experimental browser features. It **will not work** in standard Chrome.

1.  **Browser:** You must use **Google Chrome Canary** (Version 128+).
2.  **Feature Flags:** Enable the following in `chrome://flags`:
    - `#prompt-api-for-gemini-nano`: **Enabled**
    - `#optimization-guide-on-device-model`: **Enabled BypassPrefRequirement**
3.  **Model Download:**
    - Go to `chrome://components`.
    - Find **Optimization Guide On Device Model**.
    - Click **Check for Update** to download the Gemini Nano model (~1.5GB).
    - _Note: Ensure the version is listed (e.g., 2024.9.25.x) and not 0.0.0.0._

---

## 🚀 Installation

1.  Clone this repository:
    ```bash
    git clone [your-repo-url]
    cd nano-auditor-research
    ```
2.  Open Chrome Canary and navigate to `chrome://extensions`.
3.  Enable **Developer Mode** (top right toggle).
4.  Click **Load Unpacked**.
5.  Select the `src` folder from this project.

---

## 🕹️ How to Run an Audit

### 1. Prepare your Data

Create a CSV file named `urls.csv` (or use the one in the `data/` folder). It **must** have a header row named `url`.

```csv
url
http://localhost:8000/test_page.html
[https://example.com](https://example.com)
```

### 2. Start the Tool

1. Click the **Nano Auditor** icon in the Chrome toolbar to open the Side Panel.
2. Click **Choose File** and select your CSV.
3. Click **Start Batch Audit**.

The browser will automatically navigate to each page. The logs in the side panel will display the AI's real-time reasoning:

> > > Analyzing DOM... ❌ Verdict: FAIL

### 3. Export & View Results

1. Once the batch is complete, click **"Download Report Data"**.
2. This downloads a `.json` file.
3. Go to the [W3C WCAG-EM Report Tool](https://www.w3.org/WAI/eval/report-tool/).
4. Click Open Report and select your JSON file.
5. Navigate to Step 4: Audit Sample to see your AI-generated results populated in the official reporting interface.

## 🧪 Current Scope

As of `v0.1`, the tool is hard-coded to test the following criteria to validate the "Visual + Semantic" hypothesis:

| Criterion              | Rule ID               | Implementation Strategy                                                                                  |
| ---------------------- | --------------------- | -------------------------------------------------------------------------------------------------------- |
| **1.4.1 Use of Color** | `WCAG21:use-of-color` | Checks if links relying on color (e.g., blue text) lack secondary indicators like underlines or borders. |
| **2.5.3 Label in Name**| `WCAG22:label-in-name`| Checks if the accessible name of an element contains its visible label.                                  |

Future updates will expand the CRITERIA_MAP to cover the full 15-criteria scope defined in the project proposal.

## 📂 Project Structure

```
nano-auditor-research/
├── src/
│   ├── manifest.json       # Extension config & permissions
│   ├── sidepanel.html      # The UI (File input, logs)
│   ├── sidepanel.js        # The logic (Batch loop, AI prompting, JSON-LD gen)
│   └── lib/
│       └── papaparse.min.js # CSV parsing library
├── data/
│   ├── test_page.html      # A controlled test case (localhost)
│   └── urls.csv            # Sample input
└── README.md
```
