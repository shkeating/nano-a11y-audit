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
  },
};

// Ensure total is 55 for WCAG 2.2 AA consistency
const mockSummary = {
  passed: 20,
  failed: 5,
  cantTell: 2,
  inapplicable: 10,
  untested: 18, // 55 - (20+5+2+10) = 18
  totalCriteria: 55,
};

export const Default = {
  args: {
    summary: mockSummary,
  },
};

export const ManyFailures = {
  args: {
    summary: {
      passed: 5,
      failed: 25,
      cantTell: 7,
      inapplicable: 5,
      untested: 13, // 55 - (5+25+7+5) = 13
      totalCriteria: 55,
    },
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
    },
  },
};
