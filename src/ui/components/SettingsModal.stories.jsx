import { SettingsModal } from "./SettingsModal";

export default {
  title: "Views/SettingsModal",
  component: SettingsModal,
  tags: ["autodocs"],
  argTypes: {
    isOpen: { control: "boolean" },
    onClose: { action: "close" },
    onSave: { action: "save" },
    onUpdateSetting: { action: "updateSetting" },
    settings: { control: "object" },
  },
};

const defaultSettings = {
  enableMultimodal: true,
  safeList: ["email", "password", "search", "submit"],
  includePassed: false,
  includeNotPresent: false,
};

export const Open = {
  args: {
    isOpen: true,
    settings: defaultSettings,
  },
};

export const TextOnlyMode = {
  args: {
    isOpen: true,
    settings: {
      ...defaultSettings,
      enableMultimodal: false,
    },
  },
};

export const FullReporting = {
  args: {
    isOpen: true,
    settings: {
      ...defaultSettings,
      includePassed: true,
      includeNotPresent: true,
    },
  },
};
