/*─────────────────────────────────────────────────────────────
  Prompt-Scrubber  –  contentScript.js  (v0.1.6)
  • Injects a “🛡 Scrub” button only after the user starts
    typing into a textarea / content-editable chat box.
  • Alt + Shift + S  triggers the same action while focus is inside
    a non-empty text input.
  • Works with:
      – <textarea> elements (ChatGPT, Stack Overflow)
      – contenteditable="true" or role="textbox" divs (Copilot)
  • Relies on global PromptScrubberRedactor.redact()
─────────────────────────────────────────────────────────────*/

/* ─── TALK TO BACKGROUND  (async scan helper) ─────────────── */
function detectSensitive(text) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'scan', text }, resolve);   // bg.js replies with matches[]
  });
}

(function () {
  "use strict";

  /* Helper to recognise editable text inputs */
  function isTextInput(el) {
    return (
      el &&
      (el.tagName === "TEXTAREA" ||
        el.isContentEditable ||
        el.getAttribute("role") === "textbox")
    );
  }

  let detectorReady = false;

  /* one-time ping */
  chrome.runtime.sendMessage({ type: 'ping' }, (msg) => {
    if (msg?.ready) detectorReady = true;
  });


  /* Clone just the layout-critical styles onto the overlay */
  function copyTextStyles(src, dest) {
    const cs = getComputedStyle(src);
    const props = [
      'font', 'fontFamily', 'fontSize', 'fontWeight',
      'lineHeight', 'letterSpacing', 'wordSpacing',
      'whiteSpace', 'wordBreak', 'tabSize',
      'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
      'textIndent'
    ];
    props.forEach(p => dest.style[p] = cs[p]);
  }

  /* Minimal toast */
  function toast(msg) {
    const node = Object.assign(document.body.appendChild(document.createElement("div")), {
      textContent: msg,
      style:
        "position:fixed;bottom:120px;right:24px;padding:8px 12px;background:#111;color:#fff;border-radius:6px;font-size:14px;z-index:9999;opacity:0;transition:opacity .3s;",
    });
    requestAnimationFrame(() => (node.style.opacity = "0.9"));
    setTimeout(() => {
      node.style.opacity = "0";
      setTimeout(() => node.remove(), 300);
    }, 2000);
  }

  /* ─── INLINE HIGHLIGHTING CODE ─────────────────────────── */

  // Inject CSS for inline highlighting overlay
  function injectHighlightStyles() {
    if (document.getElementById("psHighlightStyles")) return;
    const style = document.createElement("style");
    style.id = "psHighlightStyles";
    style.textContent = `
      .ps-wrapper{position:relative;}
      .ps-overlay{
        position:absolute;top:0;left:0;width:100%;height:100%;
        pointer-events:none;z-index:3;
        white-space:pre-wrap;word-break:break-word;
        font:inherit;line-height:inherit;padding:inherit;
        color:transparent;               /* hide duplicate glyphs */
      }
      .ps-hl{
        color:inherit;
        text-decoration:underline wavy #ff4d6a;
      }
    `;
    document.head.appendChild(style);
  }
  injectHighlightStyles();

  /* Watch size changes (ChatGPT expands the box while typing) */
  const ro = new ResizeObserver(entries => {
    for (const { target } of entries) {
      const ov = target._highlightOverlay;
      if (ov) {
        ov.style.width  = target.clientWidth  + 'px';
        ov.style.height = target.clientHeight + 'px';
      }
    }
  });

  // Wrap the element in a container for proper overlay positioning
  function ensureWrapper(el) {
    if (el.parentNode?.classList?.contains("ps-wrapper")) return el.parentNode;
    const wrapper = document.createElement("div");
    wrapper.className = "ps-wrapper";
    wrapper.style.position = "relative";
    el.parentNode.insertBefore(wrapper, el);
    wrapper.appendChild(el);
    return wrapper;
  }

  // Create (or return) the highlighting overlay for contenteditable elements.
  function ensureHighlightOverlay(el) {
    if (el.tagName === "TEXTAREA") return null; // not needed for textarea
    const wrapper = ensureWrapper(el);
    let overlay = wrapper.querySelector(".ps-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "ps-overlay";
      wrapper.appendChild(overlay);
      /* NEW — clone font & spacing so glyphs line up 1:1 */
      copyTextStyles(el, overlay);
      ro.observe(el);
      el._highlightOverlay = overlay;
    }
    return overlay;
  }

  function removeHighlightOverlay(el) {
    if (el._highlightOverlay) {
      el._highlightOverlay.remove();
      delete el._highlightOverlay;
      el.removeEventListener("scroll", syncScroll);
    }
  }

  // simple HTML-escape
  const escapeHTML = (str) =>
    str.replace(/[&<>"']/g, (m) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));

  // quick local regex (used as optimistic fallback while waiting for bg.js)
  const sensitiveRegex = new RegExp(
   [
     "\\bAKIA[0-9A-Z]{12,20}\\b",                       // AWS access-key
     "\\b(?:sk|gh[pous]|gitpat)[-_][A-Za-z0-9]{20,}\\b", // generic token
     "[A-Za-z0-9._%+-]+@[^\\s@]+\\.[A-Za-z]{2,}",        // email
     "\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b",                // IPv4
     "\\b(?:\\d{4}[-\\s]?){3}\\d{4}\\b",                 // credit-card
     "\\bsk_(?:live|test)?_[A-Za-z0-9]{24,}\\b"          // Stripe key
   ].join("|"),
   "gi"
  );

  // scroll handler kept outside to remove later
  function syncScroll(e) {
    const el = e.target;
    if (el._highlightOverlay) el._highlightOverlay.scrollTop = el.scrollTop;
  }

  // overlay updater (debounced via requestAnimationFrame)
  const updateHighlightOverlay = (() => {
    let id = 0;
    return (el, suppliedMatches = null) => {
      if (el.tagName === "TEXTAREA") return;
      if (id) cancelAnimationFrame(id);
      id = requestAnimationFrame(() => {
        const overlay = ensureHighlightOverlay(el);
        if (!overlay) return;
        const text = el.innerText || "";
        if (!text.trim()) {
          overlay.innerHTML = "";
          return;
        }

        /* Use the matches from bg.js if available; otherwise fall back
           to the quick union regex for an instant (but maybe partial)
           preview while we wait. */
        let matches = suppliedMatches;
        if (!matches) {
          matches = [];
          let m; sensitiveRegex.lastIndex = 0;
          while ((m = sensitiveRegex.exec(text))) {
            matches.push({ start: m.index, end: m.index + m[0].length });
          }
        }

        if (!matches.length) {
          overlay.innerHTML = "";
          return;
        }

        let html = "";
        let last = 0;
        matches.sort((a, b) => a.start - b.start);
        for (const m of matches) {
          html += escapeHTML(text.slice(last, m.start));
          html += `<span class="ps-hl">${escapeHTML(text.slice(m.start, m.end))}</span>`;
          last = m.end;
        }
        html += escapeHTML(text.slice(last));
        overlay.innerHTML = html;
      });
    };
  })();

  /* ─── INPUT HANDLER & BUTTON INJECTION ─────────────────── */

  let lastActive = null;
  document.addEventListener(
    "input",
    (e) => {
      if (!isTextInput(e.target)) return;
      const el = e.target;
      const rawText = el.tagName === "TEXTAREA" ? el.value : el.innerText;
      if (!rawText.trim()) {
        if (el.tagName !== "TEXTAREA") removeHighlightOverlay(el);

         /* remove the Scrub button when no text */
        const b = document.getElementById("scrubSendBtn");
        if (b) b.remove();      
        return;
      }
      lastActive = el;

      if (el.tagName !== "TEXTAREA") {
       /* always inject UI & quick preview */
       updateHighlightOverlay(el);               // optimistic underline
       if (detectorReady) {
         detectSensitive(rawText)                // accurate matches
           .then((m) => updateHighlightOverlay(el, m));
       }

        if (!el._scrollSynced) {
          el.addEventListener("scroll", syncScroll);
          el._scrollSynced = true;
        }
      }

      /* Inject the scrub button (only once) */
      if (!document.getElementById("scrubSendBtn")) {
        const btn = document.createElement("button");
        btn.id = "scrubSendBtn";
        btn.type = "button";
        btn.innerHTML = `
          <img src="${chrome.runtime.getURL("icons/logo.png")}" alt="" width="16" height="16" style="vertical-align:middle;margin-right:4px"> Scrub`;

        Object.assign(btn.style, {
          margin: "2px 8px",
          padding: "2px 8px 2px 6px",
          fontSize: "12px",
          border: "1px solid #d0d7de",
          borderRadius: "10px",
          background: "#fff",
          cursor: "pointer",
          transition: "background .15s",
          display: "inline-flex",
          alignItems: "center",
          gap: "4px"
        });

        btn.addEventListener("mouseover", () => (btn.style.background = "#f6f8fa"));
        btn.addEventListener("mouseout", () => (btn.style.background = "#fff"));

        el.parentElement.insertBefore(btn, el.nextSibling);
        btn.addEventListener("click", () => scrubText(el));
      }
    },
    true
  );

  /* Keyboard shortcut */
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.altKey && e.shiftKey && e.key.toLowerCase() === "s" && lastActive) {
        e.preventDefault();
        scrubText(lastActive);
      }
    },
    true
  );

  /* ─── CORE SCRUB ───────────────────────────────────────── */

  function scrubText(target) {
    const raw = target.tagName === "TEXTAREA" ? target.value : target.innerText;
    const { clean, stats } = self.PromptScrubberRedactor.redact(raw);

    if (target.tagName === "TEXTAREA") {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setter.call(target, clean);
      target.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      target.innerText = clean;
    }

    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    toast(total ? `${total} sensitive items masked` : "No sensitive items detected");

    console.groupCollapsed("%c[Scrubber] Redaction preview", "color:#0a0");
    console.table(stats);
    console.groupEnd();

    removeHighlightOverlay(target);
    
/* remove button & reset shortcut focus */
    if (!clean.trim()) {
        const btn = document.getElementById("scrubSendBtn");
        if (btn) btn.remove();
        lastActive = null; 
    }
}
})();
