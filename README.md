# Gemini Nano A11y Auditor

**Browser-Native Accessibility Testing Tool with On-Device Generative AI**
_Powered by Axe-Core & Gemini Nano (Multimodal)_

## Overview

This project is a Chrome Extension that pioneers a **hybrid accessibility auditing** approach, combining the power of traditional static analysis with on-device generative AI. It performs automated accessibility auditing directly within the browser, offering a unique blend of broad-based and nuanced testing.

The tool uses two engines:

1.  **Axe Core:** The industry-standard static analysis engine for running a comprehensive baseline audit.
2.  **Gemini Nano:** An on-device Small Language Model (SLM) embedded in Chrome. This is used for sophisticated checks that require contextual or **visual understanding**, which traditional tools often miss.

This architecture ensures comprehensive test coverage while maintaining **zero latency, zero cost, and 100% data privacy** for the AI-powered checks.

### Key Capabilities

- **Batch Processing:** Accepts a CSV of URLs and automatically navigates the browser to test them sequentially.
- **Hybrid Auditing Engine:**
  - **Axe Core Integration:** Runs a full suite of established, automated accessibility checks on each page.
  - **On-Device Multimodal AI:** Captures DOM context and **screenshots** of specific elements to pass to the local Gemini Nano model. This allows the tool to "see" and reason about visual criteria (e.g., Images of Text, Use of Color) without sending data to the cloud.
- **Modular Rule System:** Features a clean, extensible registry for defining new AI-powered checks, each with its own data extractor and instruction prompt.
- **Automated Reporting:**
  - Consolidates findings from both Axe and Gemini Nano into a single **JSON-LD (EARL)** report.
  - Automatically uploads this report to the [WCAG-EM Report Tool](https://www.w3.org/WAI/eval/report-tool/) for easy viewing and analysis.

---

## Technical Architecture

The tool is orchestrated by a **Side Panel Controller** that manages the entire audit workflow:

1.  **URL Intake:** The user uploads a CSV file of URLs via the side panel UI (`sidepanel.html`).
2.  **Queue Management:** The **Side Panel Controller** (`sidepanel.js`) parses the file and manages the queue of URLs to be tested.
3.  **Navigation & Execution Loop:** For each URL in the queue, the controller:
    a. Navigates an active browser tab to the URL.
    b. Injects the **Axe Runner** (`utils/axe-runner.js`) to perform a baseline audit.
    c. Iterates through the **Rules Registry** (`src/rules/index.js`).
    d. **Multimodal Analysis:** For visual rules (e.g., 1.4.5), the extension captures a screenshot of the viewport, crops it to the relevant element coordinates, and passes the image data directly to the Gemini Nano Prompt API.
4.  **Report Aggregation:** Results from both Axe and all Nano-powered checks are collected.
5.  **Automated Submission:** Upon completion, the tool automates the submission of the generated JSON-LD report to the W3C Report Tool.

---

## Prerequisites (Crucial)

This extension relies on experimental browser features. It **will not work** in standard Chrome.

1.  **Browser:** You must use **Google Chrome Canary** (Version 128+).
2.  **Feature Flags:** Enable the following in `chrome://flags` and **restart the browser**:
    - `#prompt-api-for-gemini-nano`: **Enabled**
    - `#optimization-guide-on-device-model`: **Enabled BypassPrefRequirement**
    - `#prompt-api-for-gemini-nano-multimodal-input`: **Enabled** (Required for visual checks)
3.  **Model Download:**
    - Go to `chrome://components`.
    - Find **Optimization Guide On Device Model**.
    - Click **Check for Update** to download the Gemini Nano model (~1.5GB).
    - _Note: Ensure the version is listed (e.g., 2024.9.25.x) and not 0.0.0.0._

---

## Installation

1.  **Clone the repository:**

    ```bash
    git clone <repository-url>
    cd nano-a11y-audit
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Build the project:**

    ```bash
    npm run build
    ```

4.  **Load into Chrome:**
    - Open Chrome Canary and navigate to `chrome://extensions`.
    - Enable **Developer Mode** (top right toggle).
    - Click **Load Unpacked**.
    - Select the `dist` folder created by the build process.

---

## How to Run an Audit

### 1. Prepare your Data

Create a CSV file. It **must** have a header row named `url`.

```csv
url
[https://example.com](https://example.com)
http://localhost:8000/my-test-page.html
```

### 2. Start the Tool

1.  Click the **Nano Auditor** icon in the Chrome toolbar to open the Side Panel.
2.  Click **Choose File** and select your CSV.
3.  Click **Start Batch Audit**.

The browser will automatically navigate to each page. The logs in the side panel will show real-time progress for both Axe and Nano checks.

### 3. View Results

1.  Once the batch is complete, the tool automatically downloads a `nano-audit-report.json` file.
2.  It then opens the [W3C WCAG-EM Report Tool](https://www.w3.org/WAI/eval/report-tool/) in a new tab.
3.  It automatically injects the report data into the tool.
4.  Navigate to **Step 4: Audit Sample** (or View Report) to see your consolidated AI-generated and Axe results.

5.  Testing & Development
    The project includes a local test suite in `test-files/` covering common failures for every active rule, sourced from the WCAG understanding docs.

6.  Serve the test-files/ directory (e.g., using VS Code Live Server or python -m http.server).
7.  Create a CSV with the local URLs (e.g., http://localhost:5500/test-files/322-on-input.html).
    3, Run the auditor on these pages to verify detection logic.

---

## Auditing Scope

The hybrid engine provides broad coverage. The current scope includes:

| Engine          | Rule ID/Criterion               | Implementation Strategy                                                                      |
| --------------- | ------------------------------- | -------------------------------------------------------------------------------------------- |
| **Axe Core**    | ~40+ Rules                      | Runs the default Axe ruleset for baseline automated checks (e.g., image alts, form labels).  |
| **Gemini Nano** | `1.3.2 Meaningful Sequence`     | Checks for CSS properties (order, float, position) that disrupt logical reading order.       |
| **Gemini Nano** | `1.3.3 Sensory Characteristics` | Checks for instructions that rely solely on shape, size, color, location, or sound.          |
| **Gemini Nano** | `1.3.4 Orientation`             | Checks if content is restricted to portrait or landscape orientations (using Debugger API).  |
| **Gemini Nano** | `1.4.1 Use of Color`            | Checks if links or form fields rely only on color as a distinguishing visual cue.            |
| **Gemini Nano** | `1.4.5 Images of Text`          | **(Multimodal)** Analyzes images to detect if they contain text that should be HTML.         |
| **Gemini Nano** | `1.4.10 Reflow`                 | Simulates a 320px viewport (Debugger API) to detect horizontal scrollbars.                   |
| **Gemini Nano** | `1.4.12 Text Spacing`           | Injects WCAG-specified spacing styles to detect content clipping or overlap.                 |
| **Gemini Nano** | `2.2.2 Pause, Stop, Hide`       | Checks for animations > 5s (CSS/SVG) and flags suspicious scripted motion for review.        |
| **Gemini Nano** | `2.5.3 Label in Name`           | Checks if the accessible name of a control contains its visible text label.                  |
| **Gemini Nano** | `3.2.2 On Input`                | Checks for unexpected context changes (auto-submit, new windows) triggered by input events.  |
| **Gemini Nano** | `3.3.2 Labels or Instructions`  | Checks if form fields requiring specific formats (Date, Phone) provide visible instructions. |

## Project Structure

```text
nano-a11y-audit/
├── src/
│   ├── manifest.json           # Extension config, permissions
│   ├── sidepanel.html          # Main UI (file input, logs)
│   ├── sidepanel.js            # Core controller for the audit process
│   ├── background.js           # Service worker
│   ├── lib/                    # Static assets (copied to dist/)
│   ├── rules/                  # AI Rule definitions
│   │   ├── 1.3.2.js            # Meaningful Sequence Rule
│   │   ├── 1.3.3.js            # Sensory Characteristics Rule
│   │   ├── 1.3.4-landscape.js  # Orientation Rule (Landscape check)
│   │   ├── 1.3.4-portrait.js   # Orientation Rule (Portrait check)
│   │   ├── 1.4.1.js            # Use of Color Rule
│   │   ├── 1.4.5.js            # Images of Text Rule (Multimodal)
│   │   ├── 1.4.10.js           # Reflow Rule (320px viewport simulation)
│   │   ├── 1.4.12.js           # Text Spacing Rule (Style injection)
│   │   ├── 2.2.2.js            # Pause, Stop, Hide Rule
│   │   ├── 2.5.3.js            # Label in Name Rule
│   │   ├── 3.2.2.js            # On Input Rule
│   │   └── index.js            # Rule Registry
│   └── utils/
│       ├── axe-runner.js       # Axe Core injection & execution
│       ├── earl-reporter.js    # JSON-LD report generation
│       └── report-injector.js  # W3C Tool automation
├── test-files/                 # Local test harness with failure examples
├── dist/                       # Build output (Load this in Chrome)
├── vite.config.js              # Build configuration
└── package.json                # Dependencies and scripts
```

---

## Development

### Adding a New Rule

To add a new AI-powered accessibility check:

1.  **Create a new file** in `src/rules/` (e.g., `src/rules/1.4.3.js`).
2.  **Export the required fields**:
    - `id`: The WCAG criterion ID (e.g., `"1.4.3"`).
    - `earlId`: A unique string for the report (e.g., `"WCAG22:contrast-minimum"`).
    - `systemPrompt`: The instructions for Gemini Nano.
    - `extractor`: A function that returns the data needed for the prompt.
3.  **Register the rule**:
    - Import the new file in `src/rules/index.js`.
    - Add it to the `RULES` object.
4.  **Rebuild**: Run `npm run build` to update the extension.
