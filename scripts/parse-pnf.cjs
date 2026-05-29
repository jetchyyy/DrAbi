// parse-pnf.js  — run with:  node scripts/parse-pnf.js
// Parses the Philippine National Formulary Essential Medicines List CSV
// and outputs a clean JSON array to src/data/pnf-medicines.json

const fs   = require('fs');
const path = require('path');

const csvPath  = 'G:/Downloads/PNF-EML_11022022.csv';
const outPath  = path.join(__dirname, '../src/data/pnf-medicines.json');

// Read as latin1 so the weird DOH encoding doesn't explode
const raw   = fs.readFileSync(csvPath, 'latin1');
const lines = raw.split('\n').map(l => {
  // Strip CSV quoting, collapse commas that split numbers like "10 m","L" → "10 mL"
  return l
    .replace(/\r/g, '')
    .replace(/^"/, '').replace(/"$/, '')
    .replace(/","/g, ',')
    // Remove garbled unicode sequences from the PDF-to-CSV conversion
    .replace(/[^\x20-\x7E\xA0-\xFF]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
});

const ROUTES = ['Oral', 'Inj.', 'Topical', 'Solution', 'Inhalation',
                'Ophthalmic', 'Otic', 'Nasal', 'Rectal', 'Vaginal',
                'Transdermal', 'Inj'];

const routeRe     = new RegExp(`^(.+?)\\s+(${ROUTES.join('|')}):\\s*(.*)`);
const routeOnlyRe = new RegExp(`^(${ROUTES.join('|')}):\\s*(.*)`);

// Annotations to strip from drug names
const annotRe = /\s*\([A-Z0-9,\s\*]+\)\s*$/g;

const skipRe = /Active Ingredient|Pharmaceutical Forms|ABBREVIATIONS|MEASUREMENTS|^[A-Z\s]+EDITION|^Department|^Republic|^Published|^Volume|^MESSAGE|^For new|^www\.|^\d+\s*$/i;

const entries  = [];
const seen     = new Set();           // de-dupe exact (name+route+forms) triples
let   currentName = '';

for (const line of lines) {
  if (!line || skipRe.test(line)) continue;

  // ── Case 1: Name + Route on same line ───────────────────────────────────
  const m = line.match(routeRe);
  if (m) {
    let name  = m[1].trim().replace(annotRe, '').trim();
    const route = m[2];
    const forms = m[3].trim();
    if (name.length < 2 || name.length > 90) continue;
    currentName = name;
    const key = `${name}|${route}|${forms}`;
    if (!seen.has(key)) { seen.add(key); entries.push({ name, route, forms }); }
    continue;
  }

  // ── Case 2: Route only line (continuation of previous drug name) ─────────
  const m2 = line.match(routeOnlyRe);
  if (m2 && currentName) {
    const route = m2[1];
    const forms = m2[2].trim();
    const key = `${currentName}|${route}|${forms}`;
    if (!seen.has(key)) { seen.add(key); entries.push({ name: currentName, route, forms }); }
    continue;
  }

  // ── Case 3: Possible new drug name ──────────────────────────────────────
  if (/^[A-Z][a-zA-Z]/.test(line) && !line.includes(':') && line.length < 90) {
    currentName = line.trim();
  }
}

// ── Post-process: collapse duplicate names into one entry with multiple routes
const byName = new Map();
for (const e of entries) {
  if (!byName.has(e.name)) {
    byName.set(e.name, { name: e.name, routes: [] });
  }
  const routeStr = e.forms ? `${e.route}: ${e.forms}` : e.route;
  byName.get(e.name).routes.push(routeStr);
}

// ── Filter out bad entries picked up by the state machine ────────────────
const badNameRe = /^\d|^[A-Z]{2,}\s+[A-Z]|m,L$|^(Acid|DNA|USP grade|IV infusion|inj\.|route)\b/i;
const medicines = [...byName.values()]
  .filter(m => !badNameRe.test(m.name) && m.name.length > 3 && m.name.length < 80)
  .map(m => ({
    name: m.name,
    // Normalise "10 m,L" → "10 mL" in all route strings
    routes: m.routes.map(r => r.replace(/m,L/g, 'mL').replace(/\s+/g, ' ').trim()),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

// Ensure output directory exists
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(medicines, null, 2), 'utf8');

console.log(`✓ Parsed ${entries.length} form entries → ${medicines.length} unique medicines`);
console.log(`✓ Written to ${outPath}`);
console.log('\nSample:');
medicines.slice(0, 10).forEach(m => console.log(` • ${m.name}  [${m.routes.join(' | ')}]`));
