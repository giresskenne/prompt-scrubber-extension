/*─────────────────────────────────────────────────────────────
  Prompt-Scrubber  –  contentScript.js  (v0.1.3 Modified)
  • Injects a “🛡 Scrub & Send” button only after the user starts
    typing into a textarea / content-editable chat box.
  • Alt + Shift + S  triggers the same action while focus is inside
    a non-empty text input.
  • Works with:
      – <textarea> elements (ChatGPT, Stack Overflow)
      – contenteditable="true" or role="textbox" divs (Copilot)
  • Relies on global PromptScrubberRedactor.redact()
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
      style:
        "position:fixed;bottom:120px;right:24px;padding:8px 12px;background:#111;color:#fff;border-radius:6px;font-size:14px;z-index:9999;opacity:0;transition:opacity .3s;"
    });
    requestAnimationFrame(() => (node.style.opacity = "0.9"));
    setTimeout(() => {
      node.style.opacity = "0";
      setTimeout(() => node.remove(), 300);
    }, 2000);
  }

  /* ─── INLINE HIGHLIGHTING CODE (Added) ─────────────────── */

  // Inject CSS for inline highlighting overlay
  function injectHighlightStyles() {
    if (document.getElementById("psHighlightStyles")) return;
    const style = document.createElement("style");
    style.id = "psHighlightStyles";
    style.textContent = `
      .ps-wrapper { 
        position: relative; 
      }
      /* The overlay mirrors the text content and highlights sensitive parts */
      .ps-overlay {
        position: absolute;
        top: 0; left: 0;
        width: 100%; height: 100%;
        pointer-events: none;
        z-index: 3;
        white-space: pre-wrap;
        word-break: break-word;
      }
      /* Underlines sensitive segments with a red wavy line */
      .ps-hl { text-decoration: underline wavy red; }
    `;
    document.head.appendChild(style);
  }
  injectHighlightStyles();

  // Wrap the element in a container for proper overlay positioning
  function ensureWrapper(el) {
    if (el.parentNode && el.parentNode.classList && el.parentNode.classList.contains("ps-wrapper"))
      return el.parentNode;
    const wrapper = document.createElement("div");
    wrapper.className = "ps-wrapper";
    wrapper.style.position = "relative";
    el.parentNode.insertBefore(wrapper, el);
    wrapper.appendChild(el);
    return wrapper;
  }

  // Create (or return) the highlighting overlay for contenteditable elements.
  function ensureHighlightOverlay(el) {
    // Skip inline highlighting for <textarea>
    if (el.tagName === "TEXTAREA") return null;
    const wrapper = ensureWrapper(el);
    let overlay = wrapper.querySelector(".ps-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "ps-overlay";
      wrapper.appendChild(overlay);
      // Store a reference on the element (for easier removal later)
      el._highlightOverlay = overlay;
    }
    return overlay;
  }

  // Remove the overlay if it exists.
  function removeHighlightOverlay(el) {
    if (el._highlightOverlay) {
      el._highlightOverlay.parentNode.removeChild(el._highlightOverlay);
      delete el._highlightOverlay;
    }
  }

  // Escape HTML entities so that text is rendered correctly.
  function escapeHTML(str) {
    return str.replace(/[&<>"']/g, function (m) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[m];
    });
  }

  // Dynamically update the overlay’s content to underline sensitive parts.
  // Using the regex patterns from redactor.js:
  //  1) AWS key:             /\bAKIA[0-9A-Z]{12,20}\b/g
  //  2) Generic token:       /\b(?:sk|gh[pous]|gitpat)[-_][A-Za-z0-9]{20,}\b/g
  //  3) Email:               /[A-Za-z0-9._%+-]+@[^\s@]+\.[A-Za-z]{2,}/g
  //  4) IPv4:                /\b(?:\d{1,3}\.){3}\d{1,3}\b/g
  //  5) Credit card:         /\b(?:\d{4}[-\s]?){3}\d{4}\b/g
  //  6) Stripe key:          /\bsk_(?:live|test)?_[A-Za-z0-9]{24,}\b/g
  function updateHighlightOverlay(el) {
    // Only for contenteditable elements.
    if (el.tagName === "TEXTAREA") return;
    const overlay = ensureHighlightOverlay(el);
    if (!overlay) return;
    const text = el.innerText || "";
    if (!text.trim()) {
      overlay.innerHTML = "";
      return;
    }
    // Build a union regex from the redactor.js rules.
    const regex = new RegExp(
      [
        "\\bAKIA[0-9A-Z]{12,20}\\b",
        "\\b(?:sk|gh[pous]|gitpat)[-_][A-Za-z0-9]{20,}\\b",
        "[A-Za-z0-9._%+-]+@[^\\s@]+\\.[A-Za-z]{2,}",
        "\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b",
        "\\b(?:\\d{4}[-\\s]?){3}\\d{4}\\b",
        "\\bsk_(?:live|test)?_[A-Za-z0-9]{24,}\\b"
      ].join("|"),
      "gi"
    );
    let resultHTML = "";
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      resultHTML += escapeHTML(text.substring(lastIndex, match.index));
      resultHTML += '<span class="ps-hl">' + escapeHTML(match[0]) + "</span>";
      lastIndex = match.index + match[0].length;
    }
    resultHTML += escapeHTML(text.substring(lastIndex));
    overlay.innerHTML = resultHTML;
  }

  /* ─── END INLINE HIGHLIGHTING CODE ───────────────────────── */

  /* Inject button only after first keystroke */
  let lastActive = null;
  document.addEventListener("input", e => {
    if (!isTextInput(e.target)) return;
    const el = e.target;
    const text = el.tagName === "TEXTAREA" ? el.value : el.innerText;
    if (text.trim() === "") {
      // For contenteditable, remove overlay and restore text color.
      if (el.tagName !== "TEXTAREA") {
        removeHighlightOverlay(el);
        el.style.color = "";
      }
      return;
    }
    lastActive = el;
    // For contenteditable boxes, apply inline highlighting.
    if (el.tagName !== "TEXTAREA") {
      // Set the input text to transparent so the overlay shows the highlights.
      el.style.color = "transparent";
      el.style.caretColor = "black";
      updateHighlightOverlay(el);
    }
    // Inject the scrub button (only once)
    if (!document.getElementById("scrubSendBtn")) {
      const btn = document.createElement("button");
      btn.id = "scrubSendBtn";
      btn.type = "button"; // Prevents form submission
      btn.textContent = "🛡 Scrub";
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

    // Replace text visibly
    if (target.tagName === "TEXTAREA") {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setter.call(target, clean);
      target.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      target.innerText = clean;
      target.style.color = "";
    }

    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    const msg = total ? `${total} sensitive items masked` : "No sensitive items detected";
    toast(msg);

    console.groupCollapsed("%c[Scrubber] Redaction preview", "color:#0a0");
    console.table(stats);
    console.groupEnd();

    // User can now review & click the site’s own Send button manually.
    removeHighlightOverlay(target);
  }
})();
