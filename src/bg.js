/*─────────────────────────────────────────────────────────────
  Prompt-Scrubber – src/bg.js   (MV3 background Service Worker)
  • Static import of detectorWorker.js at initial eval
  • Then fetch patterns.json and call prepareDetector()
  • Replies to “scan” & “ping” messages
─────────────────────────────────────────────────────────────*/

'use strict';

// 1) static import at top‐level (allowed by MV3)
importScripts(chrome.runtime.getURL('src/detectorWorker.js'));

// 2) load the JSON manifest and initialize
const patternsURL = chrome.runtime.getURL('src/patterns.json');
fetch(patternsURL)
  .then(r => r.json())
  .then(({ identifiers }) => {
    self.prepareDetector(identifiers);
    console.log('[Scrubber] detector ready -', identifiers.length, 'patterns');
  })
  .catch(err => console.error('[Scrubber] failed to init detector', err));

// 3) handle incoming messages
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'scan') {
    sendResponse(self.scanDetector(msg.text || ''));
    return true;  // keep channel open for async reply
  }
  if (msg?.type === 'ping') {
    sendResponse({ ready: typeof self.scanDetector === 'function' });
    return true;
  }
});
