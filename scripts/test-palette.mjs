// Проверка единого стиля и палитры по темам. Берём настоящие функции из исходников
// и подставляем вместо DOM простую заглушку — браузерная панель ненадёжна, а убедиться,
// что фон нигде не жёлтый, надо наверняка.
import { readFileSync } from 'node:fs';

const src = f => readFileSync('src/app/js/' + f, 'utf8');
const grab = (text, start, end) => {
  const a = text.indexOf(start);
  const b = text.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error('не найдено: ' + start);
  return text.slice(a, b + end.length);
};

const sheet = grab(src('01-presets.js'), 'const WATERCOLOUR_SHEET=', "';");
const palette = grab(src('06-style-ref.js'), 'function themePalette(', '\n}');
const styleT = grab(src('06-style-ref.js'), 'function styleText(', '\n}');

let fields = {};
const build = new Function('fields', `
  const v = id => (fields[id] || '');
  const ST = { styleBlock: fields.__vision || '' };
  ${sheet}
  ${palette}
  ${styleT}
  return { themePalette, styleText, WATERCOLOUR_SHEET };
`);

let bad = 0;
const check = (n, c) => { console.log((c ? '  ✓ ' : '  ✗ ') + n); if (!c) bad++; };

const WARM = /\b(yellow|cream|ivory|beige|butter|sand|tan)\b/i;

const cases = [
  ['Halloween',   { mainKW: 'halloween boo baskets', category: 'Holiday Party', audience: 'adult' },  /dusty lilac/],
  ['Рождество',   { mainKW: 'christmas party games', category: 'Holiday Party', audience: 'mixed' },  /icy blue/],
  ['Осень',       { mainKW: 'thanksgiving menu board', category: 'General Party', audience: 'adult' },/sage/],
  ['Детский',     { mainKW: 'circus games preschool', category: 'Kids Party', audience: 'kids' },     /blush pink/],
  ['Для мальчика',{ mainKW: 'baby shower games for a boy', category: 'Baby Shower', audience: 'mixed' }, /powder blue/],
  ['Взрослые',    { mainKW: 'girls night questions', category: 'Girls Night', audience: 'adult' },     /dusty rose/],
];

console.log('Палитра по темам');
for (const [name, f, expect] of cases) {
  fields = f;
  const { themePalette } = build(fields);
  const p = themePalette();
  const ground = p.slice(p.indexOf('background is'), p.indexOf('. Accents'));
  // «фон НЕ жёлтый» — это часть запрета, его из проверки исключаем
  const groundOnly = ground.replace(/must NOT[\s\S]*/i, '');
  check(`${name.padEnd(13)} → ${groundOnly.replace('background is ', '')}`, expect.test(p) && !WARM.test(groundOnly));
}

console.log('\nЕдиный стиль');
fields = { mainKW: 'circus games', category: 'Kids Party', audience: 'kids' };
{
  const { styleText, WATERCOLOUR_SHEET } = build(fields);
  const t = styleText();
  check('без референса берётся встроенный акварельный стиль', t.startsWith(WATERCOLOUR_SHEET.slice(0, 40)));
  check('в стиле есть запрет тёплого фона', /NEVER yellow, cream, ivory, beige, butter, sand, tan/.test(t));
  check('палитра приклеена к стилю', t.includes('PALETTE: the background is'));
  check('палитра тоже запрещает тёплый фон', /must NOT be yellow/.test(t));
}
{
  fields = { ...fields, __vision: 'STYLE: dense wet-on-wet watercolour with pigment pooling.' };
  const { styleText } = build(fields);
  const t = styleText();
  check('референс перебивает встроенную технику', t.startsWith('STYLE: dense wet-on-wet'));
  check('палитра от темы всё равно добавляется', t.includes('PALETTE: the background is'));
}

console.log(bad ? '\nЕСТЬ ПРОБЛЕМЫ' : '\nстиль и палитра работают как задумано');
process.exit(bad ? 1 : 0);
