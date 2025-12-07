import { TextArea } from "./TextArea";

export default {
  title: "Base/TextArea",
  component: TextArea,
  tags: ["autodocs"],
  argTypes: {
    label: { control: "text" },
    description: { control: "text" },
    value: { control: "text" },
    rows: { control: "number" },
  },
  args: {
    onInput: fn(),
  },
};

export const Default = {
  args: {
    label: "Comments",
    value: "",
  },
};

export const WithDescription = {
  args: {
    label: "Safe List",
    description: "Enter comma-separated values to exclude from the audit.",
    value: "email, password, search",
    rows: 4,
  },
};
