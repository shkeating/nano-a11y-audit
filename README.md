# Gemini Nano A11y Auditor

**Browser-Native Accessibility Testing Tool with On-Device Generative AI**
powered by axe-core & gemini nano

## Overview

This project is a Chrome Extension that pioneers a **hybrid accessibility auditing** approach, combining the power of traditional static analysis with on-device generative AI. It performs automated accessibility auditing directly within the browser, offering a unique blend of broad-based and nuanced testing.

The tool uses two engines:

1.  **Axe Core:** The industry-standard static analysis engine for running a comprehensive baseline audit.
2.  **Gemini Nano:** An on-device Small Language Model (SLM) embedded in Chrome. This is used for sophisticated checks that require contextual or visual understanding, which traditional tools often miss.

This architecture ensures comprehensive test coverage while maintaining **zero latency, zero cost, and 100% data privacy** for the AI-powered checks.

### Key Capabilities

- **Batch Processing:** Accepts a CSV of URLs and automatically navigates the browser to test them sequentially.
- **Hybrid Auditing Engine:**
  - **Axe Core Integration:** Runs a full suite of established, automated accessibility checks on each page.
  - **On-Device Generative AI:** Injects rule-specific extractor scripts to gather targeted DOM and CSS context. This data is then passed to the local Gemini Nano model to reason about nuanced criteria (e.g., Use of Color, Meaningful Sequence) without sending data to the cloud.
- **Modular Rule System:** Features a clean, extensible registry for defining new AI-powered checks, each with its own data extractor and instruction prompt.
- **Interoperable Reporting:** Consolidates findings from both Axe and Gemini Nano into a single JSON-LD report compliant with the **W3C EARL standard**. This report can be directly imported into tools like the [WCAG-EM Report Tool](https://www.w3.org/WAI/eval/report-tool/).

---

## Technical Architecture

The tool is orchestrated by a **Side Panel Controller** that manages the entire audit workflow:

1.  **URL Intake:** The user uploads a CSV file of URLs via the side panel UI (`sidepanel.html`).
2.  **Queue Management:** The **Side Panel Controller** (`sidepanel.js`) parses the file and manages the queue of URLs to be tested.
3.  **Navigation & Execution Loop:** For each URL in the queue, the controller:
    a. Navigates an active browser tab to the URL.
    b. Injects the **Axe Runner** (`utils/axe-runner.js`) to perform a baseline audit.
    c. Iterates through the **Rules Registry** (`src/rules/index.js`). For each registered AI rule, it injects a rule-specific **Extractor Script** to collect relevant DOM properties and CSS styles.
    d. Prompts the **Gemini Nano language model** with the extracted context and a specialized system prompt designed for that rule.
4.  **Report Aggregation:** Results from both Axe and all Nano-powered checks are collected.
5.  **Report Generation:** Upon completion, the **EARL Reporter** (`utils/earl-reporter.js`) generates a unified JSON-LD report, which the user can download.

---

## Prerequisites (Crucial)

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

## Installation

1.  Clone this repository.
2.  Open Chrome Canary and navigate to `chrome://extensions`.
3.  Enable **Developer Mode** (top right toggle).
4.  Click **Load Unpacked**.
5.  Select the `src` folder from this project.

---

## How to Run an Audit

### 1. Prepare your Data

Create a CSV file. It **must** have a header row named `url`. 

```csv
url
https://example.com
http://localhost:8000/my-test-page.html
```

### 2. Start the Tool

1. Click the **Nano Auditor** icon in the Chrome toolbar to open the Side Panel.
2. Click **Choose File** and select your CSV.
3. Click **Start Batch Audit**.

The browser will automatically navigate to each page. The logs in the side panel will show real-time progress for both Axe and Nano checks.

### 3. Export & View Results

1.  Once the batch is complete, click **"Download Report Data"**.
2.  This downloads a `nano-audit-report.json` file.
3.  Go to the [W3C WCAG-EM Report Tool](https://www.w3.org/WAI/eval/report-tool/).
4.  Click **Open Report** and select your JSON file.
5.  Navigate to **Step 4: Audit Sample** to see your consolidated AI-generated and Axe results.

## Auditing Scope

The hybrid engine provides broad coverage. The current scope is focused on:

| Engine          | Rule ID/Criterion           | Implementation Strategy                                                                     |
| --------------- | --------------------------- | ------------------------------------------------------------------------------------------- |
| **Axe Core**    | `~40+ Rules`                | Runs the default Axe ruleset for baseline automated checks (e.g., image alts, form labels). |
| **Gemini Nano** | `1.3.2 Meaningful Sequence` | Checks for CSS properties that can disrupt logical reading order (e.g., `float: right`).    |
| **Gemini Nano** | `1.4.1 Use of Color`        | Checks if links or form fields rely only on color as a distinguishing visual cue.           |

## Project Structure

```
nano-a11y-audit/
├── src/
│   ├── manifest.json       # Extension config, permissions, and side panel declaration
│   ├── sidepanel.html      # The main UI (file input, logs, buttons)
│   ├── sidepanel.js        # The core controller for the audit process
│   ├── background.js       # Service worker to enable the side panel
│   ├── lib/
│   │   └── papaparse.min.js# CSV parsing library
│   ├── rules/
│   │   ├── 1.3.2.js        # AI rule for Meaningful Sequence
│   │   ├── 1.4.1.js        # AI rule for Use of Color
│   │   └── index.js        # The central registry for all AI rules
│   └── utils/
│       ├── axe-runner.js   # Injects and runs the Axe Core audit
│       ├── axe.min.js      # The Axe Core library
│       └── earl-reporter.js# Generates the final JSON-LD report
├── data/
│   └── ...                 # Sample data for testing
├── package.json            # Project dependencies and scripts
└── README.md               # This file
```
