
 * Prompt‑Scrubber — v0.1 MVP
 * A minimal Chrome/Edge/Firefox extension that masks secrets/PII inside the ChatGPT prompt box
 * before dispatching the message. 100 % client‑side, pure regex, no external services.
 *
 * ┌── Build ──────────────────────────┐
 *   yarn install      # only if you add tooling
 *   web-ext build     # Firefox/Edge; optional
 *   Load unpacked → prompt-scrubber-extension/ in chrome://extensions
 * └───────────────────────────────────┘
 *
 * Folder layout (everything is bundled here for clarity):
 *   manifest.json
 *   src/
 *     redactor.js          — detection & redaction utility (must load first so global object exists)
 *     contentScript.js     — page integration & UI wiring ( UI logic depends on redactor)
 *   icons/ (optional)
 

App name proposals

SCRUBUDY

SCRUBBER

SECURE SCRUB

Sensitive information Scrubber 


testing text:

can you debug this?  AWS key: AKIA1234567890ABCD Stripe secret: sk_test_4eC39HqLyjWDarjtT1zdp7dc User email: alice.smith@example.com Credit card: 4242 4242 4242 4242 Server IP: 10.0.15.23



Please check these dummy values before shipping:

AWS Access Key:      AKIAIOSFODNN7EXAMPLE
AWS Secret Key:     wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
Stripe Secret (live):  sk_live_4eC39HqLyjWDarjtT1zdp7dc
Stripe Secret (test):  sk_test_AbCdEfGhIjKlMnOpQrStUvWxYz123456
Credit Card:         4242 4242 4242 4242
Alt CC (no spaces):  5555444433331111
Email Address:       Alice.Smith+demo@Example-Company.Co
Internal IP:         192.168.1.100
Canadian SIN:        123-456-789

End of test.
