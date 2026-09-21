/* Every T('…') and data-i18n attribute must resolve to a key in i18n.js.
   A missing key renders as the raw key string, which is easy to miss in a
   language you do not read — so this runs in `npm test`.

   Keys built at runtime (T('onb.' + n + 't')) cannot be found by a regex,
   so they are listed by hand in `dynamic` below. Add to it when you add a
   template, or the check quietly stops covering that group. */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

process.chdir(path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));

const src = fs.readFileSync('src/js/i18n.js', 'utf8');
const used = new Set();
for (const f of ['src/js/app.js', 'src/js/chat.js']) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/\bT\(\s*'([^']+)'/g)) used.add(m[1]);
}
for (const m of fs.readFileSync('index.html', 'utf8').matchAll(/data-i18n(?:-aria|-ph)?="([^"]+)"/g)) used.add(m[1]);
const dynamic = ['src.site','src.external','src.general','src.code',
  'group.today','group.yesterday','group.lastWeek','group.older',
  'topic.code','topic.electricity','topic.mechanics','topic.heat','topic.light','topic.quantum','topic.physics',
  'settings.themeLight','settings.themeDark','settings.themeAuto',
  'day.sat','day.sun','day.mon','day.tue','day.wed','day.thu','day.fri',
  'onb.1t','onb.2t','onb.3t','onb.1b','onb.2b','onb.3b'];
dynamic.forEach(k => used.add(k));
const miss = [...used].filter(k => !k.endsWith('.') && !src.includes("'" + k + "'")).sort();
console.log(miss.length ? 'MISSING:\n  ' + miss.join('\n  ') : 'all keys present (' + used.size + ' checked)');
