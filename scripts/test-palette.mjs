// Проверка сборки промпта для печатного листа.
//
// Референс, когда он приложен, остаётся главным: Claude разбирает его подробно —
// техника, палитра, рамка, мотивы, шрифт, — и домашний стиль к нему не примешивается.
// Когда референса нет, раньше не подставлялось ничего, и генератор рисовал по своему
// усмотрению: отсюда и брались акварельные цветы по углам, потому что для печатки такого
// рода это его штамп по умолчанию. Теперь пустое место занимает домашний стиль, который
// эти углы прямо запрещает. Карточки рецептов он не трогает: у них свой вид.
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
  grab(style6, 'const DEFAULT_SHEET_STYLE=`', '`;'),
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

console.log('Без референса работает домашний стиль');
{
  const { styleText, withStyle } = build({ articleMode: 'ideas' });
  const out = withStyle('a bingo sheet with 16 squares', 'printable');
  check('разобранного референса нет', styleText() === '');
  check('домашний стиль стоит первым', out.startsWith('HOUSE ILLUSTRATION STYLE'));
  check('светлая бумага с зерном задана', /pale paper with a faint tooth/.test(out));
  check('акварель и гуашь названы', /watercolour and gouache/.test(out));
  check('приглушённая палитра названа', /Dusty rose, sage and eucalyptus/.test(out));
  check('жёлтый и кремовый фон запрещены', /NOT yellow, butter, cream, ivory/.test(out));
  check('описание листа подано как содержимое', out.includes('SHEET TO DRAW (content only'));
  check('декоративная система не требуется', !out.includes('RICHNESS'));
  check('нет инструкции про приложенную картинку', !out.includes('REF_ORIGINALITY'));

  // то самое, из-за чего всё затевалось
  check('цветы по углам запрещены прямым текстом', /NO CORNER ORNAMENT/.test(out));
  ['floral spray', 'leafy sprig', 'lavender stem', 'eucalyptus branch', 'botanical wreath', 'laurel', 'vine']
    .forEach(w => check(`«${w}» назван в запрете`, out.includes(w)));
  check('рамка по краю запрещена', /Do NOT frame the sheet with a decorative border/.test(out));
  check('углы объявлены пустой бумагой', /corners of this sheet are empty paper/.test(out));
}

console.log('\nКарточки рецептов домашний стиль не трогает');
{
  const { withStyle } = build({ articleMode: 'recipes' });
  const out = withStyle('a recipe card', 'printable');
  check('домашнего стиля нет', !out.includes('HOUSE ILLUSTRATION STYLE'));
  check('описание карточки осталось первым', out.startsWith('a recipe card'));
  check('запрет тёплого фона на месте', out.includes('BACKGROUND:'));
}

console.log('\nРеференс главнее домашнего стиля');
{
  const { withStyle } = build({ articleMode: 'ideas', __vision: 'STYLE: bold flat vector.', __ref: 'x' });
  const out = withStyle('a bingo sheet', 'printable');
  check('домашний стиль не примешивается', !out.includes('HOUSE ILLUSTRATION STYLE'));
  check('работает разобранный референс', out.startsWith('STYLE: bold flat vector'));
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
