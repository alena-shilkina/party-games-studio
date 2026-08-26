// Проверка разбора значений из CSV. Строка с режимом Ideas молча уезжала в Games,
// если колонка называлась иначе или значение было написано не слово в слово.
// Здесь проверяем, что теперь распознаётся по смыслу, а нераспознанное не проходит тихо.
import { readFileSync } from 'node:fs';

const src = readFileSync('src/app/js/17-review.js', 'utf8');
const grab = (start, end) => {
  const a = src.indexOf(start); const b = src.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error('не найдено: ' + start);
  return src.slice(a, b + end.length);
};
const code = grab('function normArticleMode(', '\n}\nfunction importBatchCSV');
const { normArticleMode, normAudience } = new Function(
  code.replace('\nfunction importBatchCSV', '') + '\nreturn {normArticleMode,normAudience};')();

// то же сопоставление заголовков, что в импорте
const header = names => names.map(h => h.toLowerCase().replace(/\s+/g, '_'));
const col = (hdr, ...names) => { for (const n of names) { const i = hdr.indexOf(n); if (i >= 0) return i; } return -1; };
const modeCol = hdr => col(header(hdr), 'article_mode', 'mode', 'article_type', 'type');

let bad = 0;
const check = (n, c) => { console.log((c ? '  ✓ ' : '  ✗ ') + n); if (!c) bad++; };

console.log('Название колонки');
for (const h of ['article_mode', 'Article Mode', 'mode', 'Mode', 'article_type', 'Type'])
  check(`«${h}» находится`, modeCol(['keyword', h, 'audience']) === 1);
check('колонки нет — честно −1', modeCol(['keyword', 'audience']) === -1);

console.log('\nЗначение режима');
const modes = [
  ['ideas', 'ideas'], ['Ideas', 'ideas'], ['IDEAS', 'ideas'],
  ['Ideas round-up', 'ideas'], ['ideas round up', 'ideas'],
  ['recipes', 'recipes'], ['Recipe round-up', 'recipes'],
  ['prompts', 'prompts'], ['Prompts + cards', 'prompts'], ['card deck', 'prompts'],
  ['games', 'games'], ['Games listicle', 'games'],
];
for (const [inp, exp] of modes) check(`«${inp}» → ${exp}`, normArticleMode(inp) === exp);
check('пусто → пусто, подставится games', normArticleMode('') === '');
check('чепуха не притворяется режимом', normArticleMode('квартальный отчёт') === '');

console.log('\nАудитория');
const auds = [
  ['adult', 'adult'], ['Adults', 'adult'],
  ['kids', 'kids'], ['Kids / family', 'kids'], ['children', 'kids'], ['toddler', 'kids'],
  ['mixed', 'mixed'], ['Mixed', 'mixed'], ['all ages', 'mixed'],
];
for (const [inp, exp] of auds) check(`«${inp}» → ${exp}`, normAudience(inp) === exp);
check('чепуха не притворяется аудиторией', normAudience('пенсионеры Марса') === '');

console.log(bad ? '\nЕСТЬ ПРОБЛЕМЫ' : '\nразбор CSV понимает нормальные написания');
process.exit(bad ? 1 : 0);
