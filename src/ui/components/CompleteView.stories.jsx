import { CompleteView } from "./CompleteView";

export default {
  title: "Views/CompleteView",
  component: CompleteView,
  tags: ["autodocs"],
  argTypes: {
    onImport: { action: "importClicked" },
    onDownload: { action: "downloadClicked" },
    onStartNew: { action: "startNewClicked" },
    summary: { control: "object" },
    results: { control: "object" },
    pageTimings: { control: "object" }, // New control for timings
  },
};

// Helper to generate mock results
const createFailures = (count, earlId) => {
  return Array.from({ length: count }, (_, i) => ({
    url: `https://example.com/page-${i + 1}`,
    earlId: earlId,
    verdict: "FAIL",
    reason: `Mock failure explanation for item ${
      i + 1
    }.\nElement: <div class="bad-example">\nExpected: accessible name.\nActual: empty.`,
    source: "MockEngine",
  }));
};

// New Helper to generate mock timings
const createTimings = (count) => {
  return Array.from({ length: count }, (_, i) => ({
    url: `https://example.com/page-${i + 1}`,
    duration: Math.floor(Math.random() * 800) + 200, // Random duration between 200-1000ms
  }));
};

const mockSummary = {
  passed: 20,
  failed: 5,
  cantTell: 2,
  inapplicable: 10,
  untested: 18,
  totalCriteria: 55,
  averageDuration: 450, // Added average metric
};

export const Default = {
  args: {
    summary: mockSummary,
    results: [
      ...createFailures(3, "WCAG22:non-text-content"),
      ...createFailures(2, "WCAG22:contrast-minimum"),
    ],
    pageTimings: createTimings(5), // Added timings
  },
};

export const ManyFailures = {
  args: {
    summary: {
      passed: 5,
      failed: 25,
      cantTell: 7,
      inapplicable: 5,
      untested: 13,
      totalCriteria: 55,
      averageDuration: 850,
    },
    results: [
      ...createFailures(10, "WCAG22:info-and-relationships"),
      ...createFailures(8, "WCAG22:labels-or-instructions"),
      ...createFailures(5, "WCAG22:headings-and-labels"),
      ...createFailures(2, "WCAG22:focus-visible"),
    ],
    pageTimings: createTimings(20),
  },
};

export const PerfectScore = {
  args: {
    summary: {
      passed: 40,
      failed: 0,
      cantTell: 0,
      inapplicable: 15,
      untested: 0,
      totalCriteria: 55,
      averageDuration: 125,
    },
    results: [],
    pageTimings: createTimings(10),
  },
};
