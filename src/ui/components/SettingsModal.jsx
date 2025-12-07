// src/ui/components/SettingsModal.jsx

export function SettingsModal({
  isOpen,
  onClose,
  onSave,
  settings,
  onUpdateSetting,
}) {
  if (!isOpen) return null;

  const { enableMultimodal, safeList, includePassed, includeNotPresent } =
    settings;

  return (
    <dialog open>
      <article>
        <header>
          <h3>Settings</h3>
          <button
            aria-label="Close"
            className="close"
            onClick={onClose}
          ></button>
        </header>

        <fieldset>
          <legend>
            <h4>Testing</h4>
          </legend>
          <label>
            <input
              type="checkbox"
              checked={enableMultimodal}
              onChange={(e) =>
                onUpdateSetting("enableMultimodal", e.target.checked)
              }
            />{" "}
            Enable Multimodal AI (Images)
          </label>
          <small
            style={{ display: "block", marginBottom: "10px", color: "#888" }}
          >
            Uncheck for faster, text-only audits.
          </small>
          <hr />
          <label>2.4.6 Heading & Labels Safe Terms (Comma Separated)</label>
          <textarea
            rows="6"
            style={{ fontSize: "0.9em" }}
            value={safeList.join(", ")}
            onInput={(e) =>
              onUpdateSetting(
                "safeList",
                e.target.value.split(",").map((s) => s.trim())
              )
            }
          />
        </fieldset>

        <fieldset>
          <legend>
            <h4>Reporting</h4>
          </legend>
          <label>
            <input
              type="checkbox"
              checked={includePassed}
              onChange={(e) =>
                onUpdateSetting("includePassed", e.target.checked)
              }
            />
            Include 'Passed' results
          </label>
          <label>
            <input
              type="checkbox"
              checked={includeNotPresent}
              onChange={(e) =>
                onUpdateSetting("includeNotPresent", e.target.checked)
              }
            />
            Include 'Not Present' results
          </label>
        </fieldset>

        <footer>
          <button className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button onClick={onSave}>Save Changes</button>
        </footer>
      </article>
    </dialog>
  );
}
