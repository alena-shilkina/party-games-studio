// Проверка сборки промпта для печатного листа.
//
// Стиль задаётся ТОЛЬКО приложенным референсом: Claude разбирает его подробно —
// техника, палитра, рамка, мотивы, шрифт. Своего встроенного стиля у приложения нет:
// именно он приносил ботанику и вензеля по углам. Без референса лист рисуется
// по описанию от Claude, и мы добавляем единственное — запрет тёплого фона.
//
// Браузерная панель ненадёжна, поэтому гоняем настоящие функции в Node.
import { readFileSync } from 'node:fs';

const src = f => readFileSync('src/app/js/' + f, 'utf8');
const grab = (text, start, end) => {
  const a = text.indexOf(start);
  const b = text.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error('не найдено: ' + start);
  return text.slice(a, b + end.length);
};

const style6 = src('06-style-ref.js');
const pieces = [
  grab(style6, 'const BACKGROUND_RULE=', "';"),
  grab(style6, 'const RICH_SHEET=',      "';"),
  grab(style6, 'const ORIGINALITY=',     "';"),
  grab(style6, 'const STYLE_LOCK=',      "anywhere else in this prompt.';"),
  grab(style6, 'function styleText(',    '\n}'),
  grab(style6, 'function withStyle(',    '\n}'),
].join('\n');

const build = fields => new Function('fields', `
  const v = id => (fields[id] || '');
  const ST = { styleBlock: fields.__vision || '' };
  const PHOTO_CONTRACT = 'PHOTO';
  const HOME_KITCHEN = 'HOME';
  const REF_ORIGINALITY = 'REF_ORIGINALITY';
  const MOTIF_ORIGINALITY = 'MOTIF_ORIGINALITY';
  const siteFooter = () => '';
  const sheetRef = () => (fields.__ref || null);
  const refModeNow = () => (fields.__mode || 'image');
  const originalityClause = () => sheetRef() ? (refModeNow()==='motifs'?MOTIF_ORIGINALITY:REF_ORIGINALITY) : ORIGINALITY;
  ${pieces}
  return { styleText, withStyle };
`)(fields);

let bad = 0;
const check = (n, c) => { console.log((c ? '  ✓ ' : '  ✗ ') + n); if (!c) bad++; };

console.log('Без референса стиль не навязывается');
{
  const { styleText, withStyle } = build({ articleMode: 'ideas' });
  const out = withStyle('a bingo sheet with 16 squares', 'printable');
  check('стилевого контракта нет', styleText() === '');
  check('описание листа осталось первым', out.startsWith('a bingo sheet with 16 squares'));
  check('запрет тёплого фона всё равно добавлен', out.includes('BACKGROUND:') && /NOT sit on yellow, cream, ivory/.test(out));
  check('декоративная система не требуется', !out.includes('RICHNESS'));
  check('нет инструкции про приложенную картинку', !out.includes('REF_ORIGINALITY'));
}

console.log('\nС референсом контракт работает целиком');
{
  const vision = 'STYLE: soft watercolour, palette of blush #f4d9df and sage #cfe6d6 on cream, thin double rule border, scattered corner clusters of small florals, high-contrast serif titles.';
  const { withStyle } = build({ articleMode: 'ideas', __vision: vision, __ref: 'data:image/png;base64,xx' });
  const out = withStyle('a bingo sheet with 16 squares', 'printable');
  check('контракт стоит первым', out.startsWith('STYLE: soft watercolour'));
  check('в контракте сохранена палитра с кодами', /#f4d9df/.test(out));
  check('в контракте сохранены рамка и мотивы', /double rule border/.test(out) && /corner clusters/.test(out));
  check('в контракте сохранён шрифт', /serif titles/.test(out));
  check('запрет тёплого фона тоже есть', out.includes('BACKGROUND:'));
  check('замок стиля стоит с двух сторон', (out.match(/CONSISTENCY — THIS SHEET IS ONE PAGE/g) || []).length === 2);
  check('описание листа подано как содержимое', out.includes('SHEET TO DRAW (content only'));
  check('декоративная система уместна — контракт есть', out.includes('RICHNESS'));
}

console.log('\nРежим с персонажами');
{
  const { withStyle } = build({ __vision: 'STYLE: gouache.', __ref: 'x', __mode: 'motifs' });
  const out = withStyle('a matching sheet', 'printable');
  check('подставлено правило переноса персонажей', out.includes('MOTIF_ORIGINALITY'));
}

console.log('\nФотографии идут своей дорогой');
{
  const { withStyle } = build({ articleMode: 'recipes', __vision: 'STYLE: gouache.', __ref: 'x' });
  const out = withStyle('a plated dish', 'illustration');
  check('стилевой контракт к фото не приклеивается', !out.includes('gouache'));
  check('используется фотоконтракт', out.startsWith('PHOTO'));
  check('в рецептах добавлен домашний кадр', out.includes('HOME'));
}

console.log(bad ? '\nЕСТЬ ПРОБЛЕМЫ' : '\nсборка промпта соответствует договорённости');
process.exit(bad ? 1 : 0);
