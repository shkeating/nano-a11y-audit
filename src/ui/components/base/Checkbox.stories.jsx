import { Checkbox } from "./Checkbox";

export default {
  title: "Base/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
  argTypes: {
    label: { control: "text" },
    description: { control: "text" },
    checked: { control: "boolean" },
  },
};

export const Default = {
  args: {
    label: "Enable Feature",
    checked: false,
  },
};

export const Checked = {
  args: {
    label: "Enable Feature",
    checked: true,
  },
};

export const WithDescription = {
  args: {
    label: "Enable Multimodal AI",
    checked: true,
    description:
      "This feature allows the AI to analyze images and visual layout.",
  },
};
