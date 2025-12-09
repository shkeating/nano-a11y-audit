import { Button } from "./Button";

export default {
  title: "Base/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "contrast"],
      description: "The visual style of the button",
    },
    outline: {
      control: "boolean",
      description: "Whether to use the outline style",
    },
    disabled: {
      control: "boolean",
      description: "Whether the button is disabled",
    },
    onClick: { action: "clicked" },
    children: {
      control: "text",
      description: "Button content",
    },
  },
  // Default args for all stories
  args: {
    children: "Button Text",
    variant: "primary",
    outline: false,
    disabled: false,
  },
};

export const Primary = {
  args: {
    variant: "primary",
    children: "Primary Action",
  },
};

export const Secondary = {
  args: {
    variant: "secondary",
    children: "Secondary Action",
  },
};

export const Contrast = {
  args: {
    variant: "contrast",
    children: "Contrast Action",
  },
};

export const Outline = {
  args: {
    outline: true,
    children: "Outline Button",
  },
};

export const Disabled = {
  args: {
    disabled: true,
    children: "Disabled Button",
  },
};
