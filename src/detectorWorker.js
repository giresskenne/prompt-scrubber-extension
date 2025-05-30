/*─────────────────────────────────────────────────────────────
  Prompt-Scrubber – detectorWorker.js  (now used as a library)
  • Exposes two globals:
      prepareDetector(patternList) → compiles the regexes
      scanDetector(text)           → returns [{start,end,name} …]
─────────────────────────────────────────────────────────────*/

let _compiled = [];

/* step-1: call once with the pattern list from patterns.json */
self.prepareDetector = function (identifiers) {
  _compiled = identifiers.map(p => ({
    name : p.name,
    mask : p.mask || null,
    re   : new RegExp(p.pattern, p.flags || 'g')
  }));
  console.log('[Scrubber] detector ready -', _compiled.length, 'patterns');
};

/* step-2: call every time you need matches */
self.scanDetector = function (text = '') {
  const matches = [];
  for (const pat of _compiled) {
    pat.re.lastIndex = 0;
    let m;
    while ((m = pat.re.exec(text))) {
      matches.push({ start: m.index, end: m.index + m[0].length, name: pat.name });
    }
  }
  return matches;
};
