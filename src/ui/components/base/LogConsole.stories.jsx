import { LogConsole } from "./LogConsole";

export default {
  title: "Base/LogConsole",
  component: LogConsole,
  tags: ["autodocs"],
};

export const Default = {
  args: {
    logs: [
      "> Initializing system...",
      "> Loading configuration...",
      "> Ready to start.",
    ],
  },
};

export const Empty = {
  args: {
    logs: [],
  },
};

export const Scrolling = {
  args: {
    logs: Array.from(
      { length: 50 },
      (_, i) => `> Log entry line ${i + 1} processing data...`
    ),
  },
};
