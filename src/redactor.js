/**************** src/redactor.js ****************/
/*─────────────────────────────────────────────────
  Prompt-Scrubber  –  redactor.js
  Pure functions for detecting & masking sensitive
  tokens.  Runs entirely client-side.
──────────────────────────────────────────────────*/

(function (root) {
  "use strict";

  /* === Rule catalogue =====================================
     id      – stable key used in logs/stats
     pattern – global RegExp
     replacer– (match:string) -> string replacement
  ========================================================= */
  const rules = [
    /* 1) AWS access-key IDs: AKIAxxxxxxxxxxxxxxxx */
    {
      id:      "aws_key",
      pattern: /\bAKIA[0-9A-Z]{12,20}\b/g,
      replacer: m => m.slice(0, 4) + "************"
    },

    /* 2) Generic long tokens starting with sk_, ghp_, gitpat_, … */
    {
      id:      "generic_token",
      pattern: /\b(?:sk|gh[pous]|gitpat)[-_][A-Za-z0-9]{20,}\b/g,
      replacer: m => m.slice(0, 4) + "********" + m.slice(-4)
    },

    /* 3) Email addresses */
    {
      id:      "email",
      pattern: /[A-Za-z0-9._%+-]+@[^\s@]+\.[A-Za-z]{2,}/g,
      replacer: m => {
        const [user, domain] = m.split("@");
        const maskedUser    = user[0] + "***";
        const maskedDomain  = domain.replace(/^[^.]+/, "***"); // keep TLD
        return `${maskedUser}@${maskedDomain}`;
      }
    },

    /* 4) IPv4 addresses */
    {
      id:      "ip",
      pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
      replacer: () => "<IP-REDACTED>"
    },

    /* 5) 16-digit credit-card-like numbers */
    {
      id:      "cc",
      pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
      replacer: m => "****-****-****-" + m.slice(-4)
    },

    /* 6) Stripe API keys */
    { id: "stripe_key", 
        pattern: /\bsk_(?:live|test)?_[A-Za-z0-9]{24,}\b/g, 
        replacer: m => m.slice(0, 4) + "********" + m.slice(-4) 
    },
  ];

  /* redact() – apply every rule once.
     Returns { clean:string, stats: {ruleId:count} }
  */
  function redact (src) {
    let clean = src;
    const stats = Object.create(null);

    for (const r of rules) {
      const before = clean;
      clean = clean.replace(r.pattern, r.replacer);
      if (before !== clean) stats[r.id] = (stats[r.id] || 0) + 1;
    }
    return { clean, stats };
  }

  /* Expose to window so the content-script can call it */
  root.PromptScrubberRedactor = { redact, rules };

})(self);
