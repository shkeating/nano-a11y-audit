import { AuditView } from "./AuditView";

export default {
  title: "Views/AuditView",
  component: AuditView,
  tags: ["autodocs"],
  argTypes: {
    enableMultimodal: {
      control: "boolean",
      description: "Whether visual/multimodal checks are enabled",
    },
    progress: {
      control: "object",
      description: "Current audit progress status",
    },
    logs: {
      control: "object",
      description: "Array of log messages",
    },
  },
};

const defaultProgress = {
  current: 0,
  total: 10,
  currentUrl: "Waiting to start...",
};

export const Idle = {
  args: {
    enableMultimodal: false,
    progress: defaultProgress,
    logs: [],
  },
};

export const AuditingTextOnly = {
  args: {
    enableMultimodal: false,
    progress: {
      current: 3,
      total: 10,
      currentUrl: "https://example.com/about",
    },
    logs: [
      "> Navigating to: https://example.com/about",
      "> Running Axe Core...",
      "> [Axe: image-alt] ❌ FAIL",
      "> Running Static Checks (12)...",
      "> [Nano: 1.3.2] ✅ PASS",
    ],
  },
};

export const AuditingMultimodal = {
  args: {
    enableMultimodal: true,
    progress: {
      current: 5,
      total: 12,
      currentUrl: "https://example.com/gallery",
    },
    logs: [
      "> Navigating to: https://example.com/gallery",
      "> Analyzing DOM...",
      "> Running Visual Checks (3)...",
      "> Capturing screenshot...",
      "> [Nano: 1.4.5] ❌ FAIL - Image contains text",
    ],
  },
};
