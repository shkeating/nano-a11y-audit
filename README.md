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

The tool uses a **modular, reactive architecture** built with **Preact** and **Vite**. It decouples the UI from the audit logic to ensure performance and maintainability.

1.  **UI Layer (Preact):**

    - **Components:** The interface is built with reusable, accessible components (`Button`, `Modal`, `LogConsole`) styled with CSS Modules and PicoCSS.
    - **State Management:** `App.jsx` orchestrates the application state (progress, logs, results) and passes data down to specific views (`SetupView`, `AuditView`, `CompleteView`).
    - **Reactive Updates:** The UI updates instantly in response to audit events without manual DOM manipulation.

2.  **Service Layer:**

    - **Audit Runner (`audit-runner.js`):** The core engine that executes tests on a specific tab. It intelligently splits rules into "Static" (text-based) and "Visual" (screenshot-based) categories.
    - **Optimization Strategy:**
      - **Parallel Execution:** Static rules run concurrently in batches to maximize speed.
      - **Smart Throttling:** Visual rules use exponential backoff and smart retries instead of hard-coded waits, reducing idle time.
    - **Storage Service:** Manages user configuration (Safe Lists) via Chrome's Storage API.

3.  **Hybrid Execution Loop:**

    - **Axe Core:** Runs first to establish a baseline.
    - **Gemini Nano:** Consumes data extracted from the DOM. For visual rules, it captures, crops, and analyzes screenshots entirely on-device.

4.  **Automated Reporting:**
    - Generates a WCAG-EM compliant JSON-LD report.
    - Automates the W3C Report Tool by injecting data directly into the DOM.

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

###Nano WCAG Rules Script & Test Case
Custom Gem
Here is the fully updated README.md, integrating the new WCAG 2.4.6 rule, the configuration instructions, and the updated auditing scope table.

Markdown

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

## Important Usage Notes

### Window Focus Required

For multimodal checks (e.g., **1.4.1 Use of Color**, **1.4.5 Images of Text**), the extension must take screenshots of the page.

- **Keep the browser window in focus** during the audit.
- Do not minimize the window or switch tabs while the audit is running.
- Chrome's `captureVisibleTab` API returns empty data if the tab is not being actively painted.

### High-DPI / Retina Displays

The tool automatically detects your device's pixel ratio to ensure screenshots are cropped correctly. No manual configuration is needed for 4K or Retina displays.

### Performance Throttling

To comply with Chrome's API quotas, image-based checks are automatically throttled (approx. 2 seconds per image). If your page has many charts or icons, the audit may take slightly longer.

--

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

### 2. Configure Settings (Optional)

You can customize specific rules to better fit your organization's context.

1.  Click the **Nano Auditor** icon in the Chrome toolbar to open the Side Panel.
2.  Click **Configure Settings**.
3.  **Safe List Configuration:** Under "Rule Configuration", you can edit the **2.4.6 Safe Terms**.
    - **Why:** The AI flags "vague" words (e.g., "Input", "Data") as violations.
    - **What to Add:** If your site uses specific acronyms or internal terms (e.g., `PID`, `CID`, `Org Code`) that act as descriptive labels, add them here (comma-separated).
4.  Click **Save Changes**. These settings are persisted locally.

### 3. Start the Tool

1.  Click **Choose File** and select your CSV.
2.  Click **Start Batch Audit**.

The browser will automatically navigate to each page. The logs in the side panel will show real-time progress for both Axe and Nano checks.

### 4. View Results

1.  Once the batch is complete, the tool automatically downloads a `nano-audit-report.json` file.
2.  It then opens the [W3C WCAG-EM Report Tool](https://www.w3.org/WAI/eval/report-tool/) in a new tab.
3.  It automatically injects the report data into the tool.
4.  Navigate to **Step 4: Audit Sample** (or View Report) to see your consolidated AI-generated and Axe results.

---

## Testing & Development

The project includes a local test suite in `test-files/` covering common failures for every active rule, sourced from the WCAG understanding docs.

1.  Serve the `test-files/` directory (e.g., using VS Code Live Server or `python -m http.server`).
2.  Create a CSV with the local URLs (e.g., `http://localhost:5500/test-files/246-headings-and-labels.html`).
3.  Run the auditor on these pages to verify detection logic.

---

## Auditing Scope

The hybrid engine provides broad coverage. The current scope includes:

| Engine          | Rule ID/Criterion               | Implementation Strategy                                                                                         |
| --------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Axe Core**    | ~40+ Rules                      | Runs the default Axe ruleset for baseline automated checks (e.g., image alts, form labels).                     |
| **Gemini Nano** | `1.3.2 Meaningful Sequence`     | Checks for CSS properties (order, float, position) that disrupt logical reading order.                          |
| **Gemini Nano** | `1.3.3 Sensory Characteristics` | Checks for instructions that rely solely on shape, size, color, location, or sound.                             |
| **Gemini Nano** | `1.3.4 Orientation`             | Checks if content is restricted to portrait or landscape orientations (using Debugger API).                     |
| **Gemini Nano** | `1.4.1 Use of Color`            | Checks if links or form fields rely only on color as a distinguishing visual cue.                               |
| **Gemini Nano** | `1.4.5 Images of Text`          | **(Multimodal)** Analyzes images to detect if they contain text that should be HTML.                            |
| **Gemini Nano** | `1.4.10 Reflow`                 | Simulates a 320px viewport (Debugger API) to detect horizontal scrollbars.                                      |
| **Gemini Nano** | `1.4.12 Text Spacing`           | Injects WCAG-specified spacing styles to detect content clipping or overlap.                                    |
| **Gemini Nano** | `2.2.2 Pause, Stop, Hide`       | Checks for animations > 5s (CSS/SVG) and flags suspicious scripted motion for review.                           |
| **Gemini Nano** | `2.4.5 Multiple Ways`           | Checks if the page offers at least two navigation methods (Search, Menus, Sitemap, etc.).                       |
| **Gemini Nano** | `2.4.6 Headings and Labels`     | **(Hybrid)** Detects vague text ("Section 1", "Data") using AI while passing standard terms via a JS Safe List. |
| **Gemini Nano** | `2.4.7 Focus Visible`           | Checks if keyboard focus indicators are removed without a visible replacement.                                  |
| **Gemini Nano** | `2.5.3 Label in Name`           | Checks if the accessible name of a control contains its visible text label.                                     |
| **Gemini Nano** | `3.2.2 On Input`                | Checks for unexpected context changes (auto-submit, new windows) triggered by input events.                     |
| **Gemini Nano** | `3.3.2 Labels or Instructions`  | Checks for missing format hints on strict fields (e.g. Date, Phone) and missing indicators on required fields.  |

---

## Project Structure

```text
nano-a11y-audit/
├── src/
│   ├── sidepanel.jsx           # Entry point (Preact Mount)
│   ├── sidepanel.html          # HTML Shell
│   ├── manifest.json           # Extension config
│   ├── background.js           # Service worker
│   │
│   ├── ui/                     # UI Layer
│   │   ├── App.jsx             # Main Application State & Logic
│   │   ├── components/         # Feature Components (Setup, Audit, Complete)
│   │   └── components/base/    # Foundational Components (Button, Modal, etc.)
│   │
│   ├── services/               # Business Logic
│   │   ├── audit-runner.js     # Orchestrates Axe + Nano execution
│   │   └── storage.js          # Chrome Storage wrapper
│   │
│   ├── rules/                  # AI Rule Definitions (Prompt + Extractor)
│   │   ├── 1.3.2.js
│   │   ├── ... (Rule files)
│   │   └── index.js            # Rule Registry
│   │
│   └── utils/                  # Helper Utilities
│       ├── axe-runner.js       # Axe Core injection
│       ├── async-helpers.js    # Batching & Retry logic
│       ├── earl-reporter.js    # JSON-LD generation
│       └── report-injector.js  # W3C Tool automation
│
├── dist/                       # Build output
└── vite.config.js              # Vite + Preact configuration
```

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

### UI Components

This project uses Storybook to track UI components for development
The storybook can be run locally with the command `npm run storybook`
The main branch storybook is deployed to Netlify and updates are deloyed on build at [https://nano-a11y-audit-ui.netlify.app/](https://nano-a11y-audit-ui.netlify.app/?path=/story/welcome--overview)
