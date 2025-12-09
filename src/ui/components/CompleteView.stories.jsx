import { CompleteView } from "./CompleteView";

export default {
  title: "Views/CompleteView",
  component: CompleteView,
  tags: ["autodocs"],
  argTypes: {
    onDownloadAgain: { action: "downloadClicked" },
    onStartNew: { action: "startNewClicked" },
  },
};

export const Default = {
  args: {},
};
