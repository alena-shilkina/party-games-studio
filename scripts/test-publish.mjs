// Проверка того, что уезжает на сайт вместе со статьёй.
//
// Виджет лайков под фотографиями перестал нажиматься: WordPress прогоняет содержимое
// поста через wpautop, а тот вставляет <br /> внутрь <script> и <style>. На живой
// странице скрипт выглядел так: «(function(){<br />  var EP=...». Синтаксис сломан,
// обработчик не вешается, кнопки рисуются и молчат. Лечится тем, что стили и скрипт
// уходят одной строкой. Здесь мы это и проверяем: после склейки скрипт обязан
// оставаться разбираемым JavaScript.
import { readFileSync } from 'node:fs';

const src = readFileSync('src/app/js/14-wp-publish.js', 'utf8');
const grab = (start, end) => {
  const a = src.indexOf(start); const b = src.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error('не найдено: ' + start);
  return src.slice(a, b + end.length);
};

// oneLine записан одной строкой, поэтому концом служит её собственный хвост,
// а не перенос со скобкой: иначе захватывается пол-файла
const { oneLine } = new Function(grab('function oneLine(', ".trim(); }") + '\nreturn {oneLine};')();

// сам блок стилей и скрипта, как он лежит в исходнике
const assets = new Function(grab('const VOTE_ASSETS=`', '`;') + '\nreturn VOTE_ASSETS;')();

let bad = 0;
const check = (n, c) => { console.log((c ? '  ✓ ' : '  ✗ ') + n); if (!c) bad++; };

console.log('Виджет лайков переживает wpautop');
{
  check('в исходнике переносы есть, иначе проверять нечего', /\n/.test(assets));

  const flat = oneLine(assets);
  check('после склейки переносов не осталось', !/\r?\n/.test(flat));

  // wpautop вставляет <br /> именно на переносах: без них ломать нечего
  const afterWpautop = flat.replace(/\r?\n/g, '<br />\n');
  check('wpautop нечего испортить', !afterWpautop.includes('<br />'));

  // скрипт обязан остаться настоящим JavaScript
  // в исходнике закрывающий тег экранирован как <\/script>, в самой строке это </script>
  const js = flat.slice(flat.indexOf('<script>') + '<script>'.length, flat.lastIndexOf('</script>'));
  check('скрипт непустой', js.trim().length > 200);
  let parses = true;
  try { new Function(js); } catch (e) { parses = false; console.log('    ' + e.message); }
  check('скрипт разбирается как JavaScript', parses);

  // однострочные комментарии убили бы всё, что стоит после них
  check('однострочных комментариев в блоке нет', !/(^|[^:'"\\])\/\//.test(assets));

  // стили должны сохраниться целиком
  check('правила стиля на месте', flat.includes('.rcg-vote-b{') && flat.includes('.rcg-vote-b.voted{'));
  check('обработчик клика на месте', flat.includes("addEventListener('click'") || flat.includes('addEventListener("click"'));
}

console.log('Склейка не портит осмысленный код');
{
  check('пробелы по краям убраны', oneLine('  a\n  b  ') === 'a b');
  check('строка без переносов не меняется', oneLine('a b c') === 'a b c');
  check('пустое остаётся пустым', oneLine('') === '');
}

console.log('\nСообщение о сломанном JSON различает две беды');
{
  const claude = readFileSync('src/app/js/04-claude.js', 'utf8');
  const a = claude.indexOf('function jsonFailMessage(');
  const b = claude.indexOf('\n}', a) + 2;
  const { jsonFailMessage } = new Function(claude.slice(a, b) + '\nreturn {jsonFailMessage};')();

  // ответ оборвался: до конца текста почти ничего не осталось
  const cut = '{"title":"a","games":[{"name":"Wildflower Jars","content":"They sit on the';
  const m1 = jsonFailMessage(cut, new Error('Expected \',\' or \'}\' after property value in JSON at position ' + (cut.length - 2)));
  check('обрыв назван обрывом', /cut off/.test(m1));
  check('в сообщении есть сам текст', /Wildflower Jars|sit on the/.test(m1));

  // документ целый, но кавычка внутри строки закрыла её раньше времени
  const broken = '{"a":"she said "yes" to it"' + ','.padEnd(400, 'x') + '"b":"tail"}';
  const m2 = jsonFailMessage(broken, new Error('Expected \',\' or \'}\' after property value in JSON at position 18'));
  check('порча кавычкой названа своим именем', /raw double quote/.test(m2));
  check('позиция и длина показаны', /18 of \d+/.test(m2));

  // без позиции в ошибке не выдумываем диагноз
  const m3 = jsonFailMessage('{}', new Error('Unexpected end of JSON input'));
  check('без позиции сообщение остаётся честным', !/cut off|double quote/.test(m3));
}

console.log(bad ? '\nЕСТЬ ПРОБЛЕМЫ' : '\nвиджет лайков доедет до сайта рабочим');
process.exit(bad ? 1 : 0);
