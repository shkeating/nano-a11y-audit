# Gemini Nano A11y Auditor

**Browser-Native Accessibility Testing with On-Device Generative AI**

- **Author:** Shauna Keating
- **Course:** HCI 550 | Project I
- **Status:** Research Prototype (v0.2)

## 📋 Overview

This project is a Chrome Extension that leverages the experimental **Chrome Prompt API (`ai.languageModel`)** to perform automated accessibility auditing directly within the browser.

Unlike traditional AI auditing tools that rely on cloud APIs (sending DOM data to external servers), this tool uses **Gemini Nano**, a Small Language Model (SLM) embedded locally in Chrome. This architecture ensures **zero latency, zero cost, and 100% data privacy**.

### Key Capabilities

- **Batch Processing:** Accepts a CSV of URLs and automatically navigates the browser to test them sequentially.
- **On-Device Inference:** Uses Gemini Nano to reason about visual accessibility criteria without an internet connection.
- **Rule-Based Architecture:** Audits are defined in a modular `rules` directory, allowing for easy expansion and maintenance. Each rule has a dedicated extractor and a system prompt.
- **Efficient Data Handling:** The extractor functions pre-filter the DOM to send only relevant information to the AI. The AI is prompted to summarize findings rather than listing every individual failure, improving performance and readability.
- **Interoperable Reporting:** Generates JSON-LD reports compliant with the **W3C EARL standard**, ready for import into the [WCAG-EM Report Tool](https://www.w3.org/WAI/eval/report-tool/).

---

## 🛠️ Technical Architecture

The tool utilizes a modular, side-panel-driven architecture:

1.  **Side Panel (`sidepanel.html`, `sidepanel.js`):** The main user interface and controller. It handles the CSV upload, manages the URL queue, and orchestrates the audit loop.
2.  **Rules (`src/rules/`):** Each accessibility check is a self-contained module (e.g., `1.4.1.js`). A rule consists of:
    *   **Extractor:** A JavaScript function injected into the active tab to scrape computed styles and relevant DOM properties. It pre-filters and slices the data to minimize the payload sent to the AI.
    *   **System Prompt:** A carefully crafted prompt that instructs the Gemini Nano model on how to analyze the extracted data and what format to return the results in.
3.  **EARL Reporter (`src/utils/earl-reporter.js`):** A utility that takes the audit results and generates a WCAG-EM Report Tool compatible JSON-LD report. Page titles are handled separately to avoid contaminating the data sent to the AI for analysis.

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

1.  Clone this repository.
2.  Open Chrome Canary and navigate to `chrome://extensions`.
3.  Enable **Developer Mode** (top right toggle).
4.  Click **Load Unpacked**.
5.  Select the `src` folder from this project.

---

## 🕹️ How to Run an Audit

### 1. Prepare your Data

Create a CSV file (e.g., `urls.csv`). It **must** have a header row named `url`.

```csv
url
http://localhost:8000/test_page.html
https://example.com
```

### 2. Start the Tool

1. Click the **Nano Auditor** icon in the Chrome toolbar to open the Side Panel.
2. Click **Choose File** and select your CSV.
3. Click **Start Batch Audit**.

The browser will automatically navigate to each page, and the side panel will show the progress.

### 3. Export & View Results

1. Once the batch is complete, click **"Download Report Data"**.
2. This downloads a `.json` file.
3. Go to the [W3C WCAG-EM Report Tool](https://www.w3.org/WAI/eval/report-tool/).
4. Click **Open Report** and select your JSON file.
5. Navigate to **Step 4: Audit Sample** to see your AI-generated results populated in the official reporting interface.

## 🧪 Current Scope

The primary focus of this prototype is to test the feasibility of on-device AI for visual and semantic accessibility checks. The following rules are currently implemented:

| Criterion | Rule ID |
| :--- | :--- |
| **1.3.2 Meaningful Sequence** | `WCAG22:meaningful-sequence` |
| **1.4.1 Use of Color** | `WCAG22:use-of-color` |

## 📂 Project Structure

```
nano-a11y-audit/
├── src/
│   ├── manifest.json
│   ├── sidepanel.html
│   ├── sidepanel.js
│   ├── lib/
│   │   └── papaparse.min.js
│   ├── rules/
│   │   ├── 1.3.2.js
│   │   ├── 1.4.1.js
│   │   └── index.js
│   └── utils/
│       └── earl-reporter.js
├── data/
│   ├── ...
└── README.md
```