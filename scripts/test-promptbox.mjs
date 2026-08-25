// Разовая проверка редактора промпта: берём настоящие esc() и promptBox() из исходников
// и смотрим, что выходит. Браузерная панель не отвечала, а проверить экранирование надо:
// в промпты попадают кавычки и угловые скобки, и кривой вывод сломал бы разметку.
import { readFileSync } from 'node:fs';

const src = f => readFileSync('src/app/js/' + f, 'utf8');
const grab = (text, startsWith, endsWith) => {
  const a = text.indexOf(startsWith);
  const b = text.indexOf(endsWith, a);
  if (a < 0 || b < 0) throw new Error('не найдено: ' + startsWith);
  return text.slice(a, b + endsWith.length);
};

const escSrc = grab(src('01-presets.js'), 'const esc=', '\n');
const boxSrc = grab(src('13-preview.js'), 'function promptBox(', '\n}');
const { promptBox } = new Function(escSrc + '\n' + boxSrc + '\nreturn {promptBox};')();

let bad = 0;
const check = (n, c) => { console.log((c ? '  ✓ ' : '  ✗ ') + n); if (!c) bad++; };

const nasty = 'Draw a "bingo" card <b>bold</b> & 5 rows';
const html = promptBox(nasty, 'setGamePrompt(3,this.value)');

check('без setter ничего не рисуется', promptBox('текст', '') === '');
check('это раскрывающийся блок', html.startsWith('<details class="pw">'));
check('обработчик подставлен', html.includes('onchange="setGamePrompt(3,this.value)"'));
check('угловые скобки экранированы', html.includes('&lt;b&gt;bold&lt;/b&gt;') && !html.includes('<b>bold</b>'));
check('кавычки экранированы', html.includes('&quot;bingo&quot;'));
check('амперсанд экранирован', html.includes('&amp; 5 rows'));
check('пустой промпт не ломает разметку', promptBox('', 'x(this.value)').includes('<textarea'));
check('подпись подставляется', promptBox('a', 'x', 'Prompt — extra shot 2').includes('Prompt — extra shot 2'));

console.log(bad ? '\nЕСТЬ ПРОБЛЕМЫ' : '\nредактор промпта собирается корректно');
process.exit(bad ? 1 : 0);
