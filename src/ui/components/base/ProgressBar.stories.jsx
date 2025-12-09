import { ProgressBar } from "./ProgressBar";

export default {
  title: "Base/ProgressBar",
  component: ProgressBar,
  tags: ["autodocs"],
  argTypes: {
    current: { control: "number" },
    total: { control: "number" },
    label: { control: "text" },
  },
};

export const Empty = {
  args: {
    label: "Audit Progress",
    current: 0,
    total: 100,
  },
};

export const InProgress = {
  args: {
    label: "Audit Progress",
    current: 45,
    total: 100,
  },
};

export const Complete = {
  args: {
    label: "Audit Progress",
    current: 100,
    total: 100,
  },
};
