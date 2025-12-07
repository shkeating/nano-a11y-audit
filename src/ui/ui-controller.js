// src/ui/ui-controller.js

export const UI = {
  // --- DOM ELEMENTS ---
  logArea: document.getElementById("log"),
  progressBar: document.getElementById("auditProgress"),
  progressText: document.getElementById("progressText"),
  currentUrlText: document.getElementById("currentUrl"),

  // Views
  setupView: document.getElementById("setup"),
  auditView: document.getElementById("auditView"),
  statusArea: document.getElementById("statusArea"),
  completeView: document.getElementById("completeView"),
  warningBox: document.getElementById("focusWarning"),

  /**
   * Appends a message to the on-screen log.
   * @param {string} msg
   */
  log(msg) {
    if (!this.logArea) return;
    const entry = document.createElement("div");
    entry.classList.add("log-entry");
    entry.textContent = `> ${msg}`;
    this.logArea.appendChild(entry);
    this.logArea.scrollTop = this.logArea.scrollHeight;
  },

  /**
   * Updates the progress bar and status text.
   */
  updateProgress(current, total, url) {
    if (this.progressBar) {
      this.progressBar.value = current;
      this.progressBar.max = total;
      this.progressBar.removeAttribute("indeterminate");
    }
    if (this.progressText)
      this.progressText.textContent = `${current}/${total}`;
    if (this.currentUrlText) this.currentUrlText.textContent = url;
  },

  /**
   * Toggles between the Setup view and the Active Audit view.
   * @param {boolean} isAuditing
   * @param {boolean} isMultimodal
   */
  setAuditState(isAuditing, isMultimodal = false) {
    if (isAuditing) {
      this.setupView.setAttribute("hidden", "true");
      this.auditView.removeAttribute("hidden");
      this.statusArea.removeAttribute("hidden");
      this.completeView.setAttribute("hidden", "true");

      if (isMultimodal && this.warningBox) {
        this.warningBox.removeAttribute("hidden");
      } else if (this.warningBox) {
        this.warningBox.setAttribute("hidden", "true");
      }
    } else {
      // Complete state
      this.statusArea.setAttribute("hidden", "true");
      this.completeView.removeAttribute("hidden");
      if (this.warningBox) this.warningBox.setAttribute("hidden", "true");
    }
  },

  /**
   * Attaches listeners to the Settings Modal.
   * @param {Function} onSave - Callback receiving the new list string.
   */
  initSettingsModal(onSave) {
    const modal = document.getElementById("settingsModal");
    const openBtn = document.getElementById("openSettingsBtn");
    const closeX = document.getElementById("modalCloseX");
    const cancelBtn = document.getElementById("modalCancelBtn");
    const saveBtn = document.getElementById("saveSettingsBtn");
    const input = document.getElementById("safeListInput");

    if (openBtn)
      openBtn.addEventListener("click", () => modal && modal.showModal());
    if (closeX) closeX.addEventListener("click", () => modal && modal.close());
    if (cancelBtn)
      cancelBtn.addEventListener("click", () => modal && modal.close());

    // Close on backdrop click
    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.close();
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        if (onSave && input) {
          onSave(input.value);
          modal.close();
        }
      });
    }
  },

  /**
   * Sets the value of the textarea in the settings modal.
   */
  setSettingsInputValue(list) {
    const input = document.getElementById("safeListInput");
    if (input) input.value = list.join(", ");
  },
};
