import { Welcome } from "./Welcome";

export default {
  title: "Welcome",
  component: Welcome,
  parameters: {
    layout: "padded",
    options: { showPanel: false }, // Hides the addons panel for this page
    controls: { disable: true },
  },
};

export const Overview = {};
