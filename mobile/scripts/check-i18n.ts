/* Vérifie que chaque clé de traduction utilisée dans le code existe en fr, ar et en. Usage : npx tsx scripts/check-i18n.ts */
import fs from 'node:fs';
import path from 'node:path';
import fr from '../src/locales/fr';
import ar from '../src/locales/ar';
import en from '../src/locales/en';

const flat = (o: Record<string, unknown>, p = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v as Record<string, unknown>, `${p}${k}.`) : [`${p}${k}`]));
const files: string[] = [];
const walk = (d: string) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) && !p.includes('locales') && files.push(p); } };
walk(path.join(__dirname, '../src'));
const used = new Set<string>();
const ns = Object.keys(fr).join('|');
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(new RegExp(`['\`]((?:${ns})\\.[A-Za-z0-9_.]+)['\`]`, 'g'))) used.add(m[1]);
}
let missing = 0;
for (const [lang, dict] of Object.entries({ fr, ar, en })) {
  const keys = new Set(flat(dict as never).map((k) => k.replace(/_(one|other|zero|two|few|many)$/, '')));
  for (const k of used) if (!keys.has(k) && !flat(dict as never).some((x) => x.startsWith(k + '.'))) { console.log(`[${lang}] manquant : ${k}`); missing++; }
  const frKeys = new Set(flat(fr as never));
  for (const k of flat(dict as never)) if (!frKeys.has(k)) { console.log(`[${lang}] en trop : ${k}`); }
}
console.log(missing ? `${missing} clé(s) manquante(s)` : `OK — ${used.size} clés vérifiées`);
process.exit(missing ? 1 : 0);
