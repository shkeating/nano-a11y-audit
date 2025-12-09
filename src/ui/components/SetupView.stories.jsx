import { SetupView } from "./SetupView";

export default {
  title: "Views/SetupView",
  component: SetupView,
  tags: ["autodocs"],
  argTypes: {
    urlCount: { control: "number" },
    onFileUpload: { action: "fileUploaded" },
    onOpenSettings: { action: "openSettings" },
    onStartAudit: { action: "startAudit" },
  },
};

export const Default = {
  args: {
    urlCount: 0,
  },
};

export const WithUrlsLoaded = {
  args: {
    urlCount: 25,
  },
};
