// Проверка единого стиля печатных листов. Конкретный цвет фона мы не задаём — его
// подбирает генератор картинок. Здесь убеждаемся, что рамки на месте: тёплый фон
// запрещён, фон требуется одинаковый по всему набору, а референс перебивает технику,
// но правило фона не отменяет. Браузерная панель ненадёжна, поэтому проверяем в Node.
import { readFileSync } from 'node:fs';

const src = f => readFileSync('src/app/js/' + f, 'utf8');
const grab = (text, start, end) => {
  const a = text.indexOf(start);
  const b = text.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error('не найдено: ' + start);
  return text.slice(a, b + end.length);
};

const sheet   = grab(src('01-presets.js'),   'const WATERCOLOUR_SHEET=', "';");
const bgRule  = grab(src('06-style-ref.js'), 'const BACKGROUND_RULE=',   "';");
const styleT  = grab(src('06-style-ref.js'), 'function styleText(',      '\n}');

const build = fields => new Function('fields', `
  const v = id => (fields[id] || '');
  const ST = { styleBlock: fields.__vision || '' };
  ${sheet}
  ${bgRule}
  ${styleT}
  return { styleText, WATERCOLOUR_SHEET, BACKGROUND_RULE };
`)(fields);

let bad = 0;
const check = (n, c) => { console.log((c ? '  ✓ ' : '  ✗ ') + n); if (!c) bad++; };

console.log('Единый стиль');
{
  const { styleText, WATERCOLOUR_SHEET } = build({});
  const t = styleText();
  check('без референса берётся встроенный акварельный стиль', t.startsWith(WATERCOLOUR_SHEET.slice(0, 40)));
  check('в стиле есть запрет тёплого фона', /NEVER yellow, cream, ivory, beige, butter, sand, tan/.test(t));
  check('правило фона приклеено', t.includes('BACKGROUND AND PALETTE:'));
  check('правило фона тоже запрещает тёплый тон', /must NOT be yellow/.test(t));
  check('чистый белый тоже запрещён', /must not be plain white/.test(t));
  check('фон одинаков по всему набору', /SAME ground and the SAME accent family on EVERY sheet/.test(t));
  check('конкретный цвет не назначен', !/the background is a (soft|pale|muted)/.test(t));
}

console.log('\nРеференс');
{
  const { styleText } = build({ __vision: 'STYLE: dense wet-on-wet watercolour with pigment pooling.' });
  const t = styleText();
  check('референс перебивает встроенную технику', t.startsWith('STYLE: dense wet-on-wet'));
  check('правило фона всё равно добавляется', t.includes('BACKGROUND AND PALETTE:'));
}

console.log('\nТема не влияет на цвет');
{
  const a = build({ mainKW: 'halloween boo baskets', category: 'Holiday Party', audience: 'adult' }).styleText();
  const b = build({ mainKW: 'circus games preschool', category: 'Kids Party', audience: 'kids' }).styleText();
  check('контракт не зависит от темы — цвет выбирает генератор', a === b);
}

console.log(bad ? '\nЕСТЬ ПРОБЛЕМЫ' : '\nстиль и правило фона работают как задумано');
process.exit(bad ? 1 : 0);
