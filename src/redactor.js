/****************  src/redactor.js  ****************/
/*─────────────────────────────────────────────────
  Prompt-Scrubber – redactor.js  (ES module)
  Pure functions for masking sensitive tokens.
──────────────────────────────────────────────────*/

import { rules } from './gen/redactorRules.js';   // ⭐ stays an import

/* redact() – apply every rule once. */
export function redact(src) {
  let out = src, stats = Object.create(null);
  for (const r of rules) {
    const before = out;
    out = out.replace(r.pattern, r.replacer);
    if (before !== out) stats[r.id] = (stats[r.id] || 0) + 1;
  }
  return { clean: out, stats };
}

/* Expose to window so contentScript can call it after bundling */
if (typeof window !== 'undefined') {
  window.PromptScrubberRedactor = { redact, rules };
}
