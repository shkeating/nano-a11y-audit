import { Modal } from "./base/Modal";
import { Button } from "./base/Button";
import { Checkbox } from "./base/Checkbox";
import { TextArea } from "./base/TextArea";

export function SettingsModal({
  isOpen,
  onClose,
  onSave,
  settings,
  onUpdateSetting,
}) {
  const { enableMultimodal, safeList, includePassed, includeNotPresent } =
    settings;

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose}>
        Cancel
      </Button>
      <Button onClick={onSave}>Save Changes</Button>
    </>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings" footer={footer}>
      <fieldset>
        <legend>
          <h4>Testing</h4>
        </legend>

        <Checkbox
          label="Enable Multimodal AI (Images)"
          checked={enableMultimodal}
          onChange={(e) =>
            onUpdateSetting("enableMultimodal", e.target.checked)
          }
          description="Uncheck for faster, text-only audits."
        />

        <hr />

        <TextArea
          label="2.4.6 Heading & Labels Safe Terms (Comma Separated)"
          value={safeList.join(", ")}
          onInput={(e) =>
            onUpdateSetting(
              "safeList",
              e.target.value.split(",").map((s) => s.trim())
            )
          }
          description="Add your organization's specific acronyms or internal terms here to prevent false positives."
          rows={6}
        />
      </fieldset>

      <fieldset>
        <legend>
          <h4>Reporting</h4>
        </legend>

        <Checkbox
          label="Include 'Passed' results"
          checked={includePassed}
          onChange={(e) => onUpdateSetting("includePassed", e.target.checked)}
        />

        <Checkbox
          label="Include 'Not Present' results"
          checked={includeNotPresent}
          onChange={(e) =>
            onUpdateSetting("includeNotPresent", e.target.checked)
          }
        />
      </fieldset>
    </Modal>
  );
}
