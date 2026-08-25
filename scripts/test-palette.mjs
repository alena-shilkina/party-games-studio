// Проверка стиля печатных листов. Стиль один: современная акварель — насыщенная,
// с настоящими персонажами. Отдельно следим, что вернулось НЕ то, что уже отвергли:
// приглушённая пастель, ботанические веточки по углам, вензеля и строгая антиква.
// Браузерная панель ненадёжна, поэтому гоняем настоящие функции в Node.
import { readFileSync } from 'node:fs';

const src = f => readFileSync('src/app/js/' + f, 'utf8');
const grab = (text, start, end) => {
  const a = text.indexOf(start);
  const b = text.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error('не найдено: ' + start);
  return text.slice(a, b + end.length);
};

const sheet  = grab(src('01-presets.js'),   'const WATERCOLOUR_SHEET=', "Never plain white either.';");
const bgRule = grab(src('06-style-ref.js'), 'const BACKGROUND_RULE=',   "';");
const styleT = grab(src('06-style-ref.js'), 'function styleText(',      '\n}');

const build = fields => new Function('fields', `
  const v = id => (fields[id] || '');
  const ST = { styleBlock: fields.__vision || '' };
  ${sheet}
  ${bgRule}
  ${styleT}
  return { styleText, WATERCOLOUR_SHEET };
`)(fields);

let bad = 0;
const check = (n, c) => { console.log((c ? '  ✓ ' : '  ✗ ') + n); if (!c) bad++; };

const t = build({}).styleText();

console.log('Чего в стиле быть не должно');
check('не просит приглушённую пастель',      !/muted and tasteful|soft pastel palette/i.test(t));
check('не просит ботанические веточки',      !/delicate painted botanical sprigs/i.test(t));
check('не просит строгую антикву',           !/clean modern serif for the title/i.test(t));
check('ботаника прямо запрещена',            /NO delicate botanical sprigs, leaves, blossoms/.test(t));
check('вензеля и гравюрные рамки запрещены', /scrollwork, filigree, flourishes/.test(t));
check('свадебная антиква запрещена',         /NOT a formal high-contrast serif/.test(t));
check('бледная пастель названа провалом',    /pale washed-out pastel haze is a failure/.test(t));

console.log('\nЧто в стиле должно быть');
check('акварель как техника',            /modern hand-painted watercolour illustration/.test(t));
check('яркая и чёткая заявлена сразу',   /bright, crisp, lively and characterful/.test(t));
check('это рисуют сегодня, а не в 2000-х', /not like 2000s clip-art/.test(t));
check('запрет мутного и размытого',      /Nothing muddy, blurry, hazy, soft-focus, faded or washed out/.test(t));
check('чёткие силуэты',                  /defined silhouettes, clean confident shapes/.test(t));
check('насыщенный цвет',                 /bright, clear and properly saturated/.test(t));
check('настоящие персонажи и предметы',  /characters, animals, people, food, objects, props/.test(t));
check('крупный читаемый шрифт',          /comfortably large and easy to read/.test(t));
check('тёплый фон запрещён',             /NEVER yellow, cream, ivory, beige/.test(t));
check('чистый белый запрещён',           /Never plain white either/.test(t));
check('правило фона приклеено',          t.includes('BACKGROUND AND PALETTE:'));
check('фон одинаков по набору',          /SAME ground and the SAME accent family on EVERY sheet/.test(t));

console.log('\nРеференс');
{
  const withRef = build({ __vision: 'STYLE: dense gouache with visible brush marks.' }).styleText();
  check('референс перебивает встроенную технику', withRef.startsWith('STYLE: dense gouache'));
  check('правило фона всё равно добавляется',     withRef.includes('BACKGROUND AND PALETTE:'));
}

console.log('\nСтиль один для всех');
{
  const a = build({ audience: 'kids',  category: 'Kids Party'  }).styleText();
  const b = build({ audience: 'adult', category: 'Girls Night' }).styleText();
  check('контракт не зависит от аудитории и темы', a === b);
}

console.log(bad ? '\nЕСТЬ ПРОБЛЕМЫ' : '\nстиль соответствует тому, что просили');
process.exit(bad ? 1 : 0);
