import { fn } from "@storybook/test";
import { Modal } from "./Modal";
import { Button } from "./Button";

export default {
  title: "Base/Modal",
  component: Modal,
  tags: ["autodocs"],
  argTypes: {
    isOpen: { control: "boolean" },
    title: { control: "text" },
  },
  args: {
    onClose: fn(),
  },
};

export const Default = {
  args: {
    isOpen: true,
    title: "Confirm Settings",
    children: (
      <p>
        Are you sure you want to save these changes? This action cannot be
        undone.
      </p>
    ),
    footer: (
      <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
        <Button variant="secondary">Cancel</Button>
        <Button>Save Changes</Button>
      </div>
    ),
  },
};
