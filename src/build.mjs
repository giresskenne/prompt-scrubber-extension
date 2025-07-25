/**
 * build.mjs
 * ----------
 * Generates src/gen/redactorRules.js from src/patterns.json.
 * Run:  node src/build.mjs    (automatically executed by “npm run build”)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const PATTERN_FILE = path.join(__dirname, 'patterns.json');
const GEN_DIR      = path.join(__dirname, 'gen');
const OUT_FILE     = path.join(GEN_DIR, 'redactorRules.js');

const { identifiers } = JSON.parse(fs.readFileSync(PATTERN_FILE, 'utf8'));

/* ------------------------------------------------------------
   helper → produce a JS replacer function for each entry
------------------------------------------------------------- */
function mkReplacer(entry) {
    const safeID = (entry.id || entry.name || 'token')
        .toString().toUpperCase().replace(/\s+/g, '_');
  // 1) If the JSON has "jsReplacer" use it verbatim (advanced cases)
  if (entry.jsReplacer) {
    return entry.jsReplacer.trim();            // must be like "(m)=> …"
  }

  // 2) If a simple mask string exists -> constant or capture-replace
  if (entry.mask !== undefined) {
    const mask = entry.mask;
    // supports $&, $1, … replacements
    if (mask.includes('$')) {
      return `(m,...g)=>${JSON.stringify(mask)}
        .replace('$&',m)
        .replace(/\\$(\\d)/g,(_,i)=>g[i-1]||'')`;
    }
    // constant replacement
    return `() => ${JSON.stringify(mask)}`;
  }

  // 3) Fallback generic redaction tag
  return `() => "<${safeID}-REDACTED>"`;
}

/* ------------------------------------------------------------
   build rules array source
------------------------------------------------------------- */
const ruleLines = identifiers.map((p) => {
  const flags   = p.flags || 'g';
  const id      = p.id || (p.name ?? '').toLowerCase().replace(/\s+/g, '_');
  return `  {
    id: "${id}",
    pattern: new RegExp(${JSON.stringify(p.pattern)}, "${flags}"),
    replacer: ${mkReplacer(p)}
  }`;
}).join(',\n');

const out = `// AUTO-GENERATED by build.mjs – DO NOT EDIT
export const rules = [
${ruleLines}
];
`;

/* write file */
fs.mkdirSync(GEN_DIR, { recursive: true });
fs.writeFileSync(OUT_FILE, out, 'utf8');
console.log('[build] redactorRules.js written ->', path.relative(process.cwd(), OUT_FILE));
