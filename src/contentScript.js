/*─────────────────────────────────────────────────────────────
  Prompt-Scrubber  –  contentScript.js  (v0.1.3)
  • Injects a “🛡 Scrub & Send” button only after the user starts
    typing into a textarea / content-editable chat box.
  • Alt + Shift + S  triggers the same action while focus is
    inside a non-empty text input.
  • Works with:
      – <textarea> elements (ChatGPT, Stack Overflow)
      – contenteditable="true" or role="textbox" divs (Copilot)
  • Relies on global  PromptScrubberRedactor.redact()
─────────────────────────────────────────────────────────────*/

(function () {
  "use strict";

  /* Helper to recognise editable text inputs */
  function isTextInput(el) {
    return el && (el.tagName === "TEXTAREA" || el.isContentEditable || el.getAttribute("role") === "textbox");
  }

  /* Minimal toast */
  function toast(msg) {
    const node = Object.assign(document.body.appendChild(document.createElement("div")), {
      textContent: msg,
      style: "position:fixed;bottom:120px;right:24px;padding:8px 12px;background:#111;color:#fff;border-radius:6px;font-size:14px;z-index:9999;opacity:0;transition:opacity .3s;"
    });
    requestAnimationFrame(() => (node.style.opacity = "0.9"));
    setTimeout(() => { node.style.opacity = "0"; setTimeout(() => node.remove(), 300); }, 2000);
  }

  /* Inject button only after first keystroke */
  let lastActive = null;
  document.addEventListener("input", e => {
    if (!isTextInput(e.target)) return;
    const el = e.target;
    const text = el.tagName === "TEXTAREA" ? el.value : el.innerText;
    if (text.trim() === "") return;
    lastActive = el;
    if (!document.getElementById("scrubSendBtn")) {
      const btn = document.createElement("button");
      btn.id = "scrubSendBtn";
      btn.textContent = "🛡 Scrub"; // no auto‑send now
      Object.assign(btn.style, { margin: "4px 8px", padding: "4px 8px", fontSize: "12px" });
      el.parentElement.insertBefore(btn, el.nextSibling);
      btn.addEventListener("click", () => scrubText(el));
    }
  }, true);

  /* Keyboard shortcut */
  document.addEventListener("keydown", e => {
    if (e.altKey && e.shiftKey && e.key.toLowerCase() === "s" && lastActive) {
      e.preventDefault();
      scrubText(lastActive);
    }
  }, true);

  /* Core scrub (no send) */
  function scrubText(target) {
    const raw = target.tagName === "TEXTAREA" ? target.value : target.innerText;
    const { clean, stats } = self.PromptScrubberRedactor.redact(raw);

    // replace text visibly
    if (target.tagName === "TEXTAREA") {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setter.call(target, clean);
      target.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      target.innerText = clean;
    }

    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    const msg = total ? `${total} sensitive items masked` : "No sensitive items detected";
    toast(msg);

    console.groupCollapsed("%c[Scrubber] Redaction preview", "color:#0a0");
    console.table(stats);
    console.groupEnd();

    // User can now review & click the site’s own Send button manually.
  }
})();
