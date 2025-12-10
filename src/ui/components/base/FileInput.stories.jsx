import { FileInput } from "./FileInput";

export default {
  title: "Base/FileInput",
  component: FileInput,
  tags: ["autodocs"],
  argTypes: {
    label: { control: "text" },
    accept: { control: "text" },
  },
};

export const Default = {
  args: {
    label: "Upload CSV:",
    accept: ".csv",
  },
};

export const WithHelperContent = {
  args: {
    label: "Upload Config:",
    accept: ".json",
    helperContent: <strong>✅ Config loaded successfully.</strong>,
  },
};
