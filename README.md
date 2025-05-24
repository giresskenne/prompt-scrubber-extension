/*
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
 */

/**************** manifest.json ****************/
