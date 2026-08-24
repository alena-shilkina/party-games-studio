// Проверка собранной страницы перед выкладкой.
//
// Раньше здесь была побайтовая сверка с версией, скачанной с сайта. Она годилась,
// пока переезд был чистым переносом. Теперь приложение развивается, интерфейс и промпты
// меняются осознанно, и такая сверка мешала бы вместо того, чтобы защищать.
//
// Вместо неё проверяем то, что действительно должно быть верно всегда.

import { readFileSync, writeFileSync, readdirSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const built = readFileSync('dist/app.html', 'utf8');
const body  = built.slice(built.indexOf('<body>'), built.indexOf('<script>'));
const js    = built.slice(built.indexOf('<script>') + '<script>'.length, built.lastIndexOf('</script>'));

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { console.log('  ✗ ' + m); bad++; };
const group = m => console.log('\n' + m);

group('Сборка');
{
  const mods = readdirSync('src/app/js').filter(f => f.endsWith('.js')).sort();
  const empty = mods.filter(f => !readFileSync('src/app/js/' + f, 'utf8').trim());
  empty.length ? fail('пустые модули: ' + empty.join(', ')) : ok(`${mods.length} модулей, все непустые`);

  // код собирается конкатенацией, так что сломанный синтаксис заметен только здесь
  const dir = mkdtempSync(join(tmpdir(), 'pgs-'));
  const f = join(dir, 'app.js');
  writeFileSync(f, js, 'utf8');
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); ok('JS разбирается без синтаксических ошибок'); }
  catch (e) { fail('синтаксическая ошибка в JS:\n' + String(e.stderr || e.message).split('\n').slice(0, 6).join('\n')); }
}

group('Наследие хостинга');
{
  built.includes('/cf-fonts/')                  ? fail('остался блок шрифтов от Cloudflare') : ok('блока шрифтов Cloudflare нет');
  built.includes('cdn-cgi/challenge-platform')  ? fail('остался анти-бот скрипт') : ok('анти-бот скрипта нет');
  built.includes('fonts.googleapis.com/css2')   ? ok('шрифты подключены ссылкой') : fail('шрифты не подключены');
}

group('Ключи не уходят в браузер');
{
  const direct = js.match(/https:\/\/api\.(anthropic|runware|pexels)[^'"]*/g);
  direct ? fail('прямые вызовы внешних API: ' + [...new Set(direct)].join(', ')) : ok('Anthropic, Runware и Pexels — только через Worker');

  const wpDirect = (js.match(/site\.url\+'\/wp-[^']*/g) || []).filter(m => !m.includes('wp-admin'));
  wpDirect.length ? fail('прямые вызовы WordPress: ' + wpDirect.join(', ')) : ok('WordPress — только через Worker');

  ['/api/claude', '/api/runware', '/api/pexels', '/api/wp', '/api/keys'].forEach(r =>
    js.includes(r) ? ok('используется ' + r) : fail('маршрут ' + r + ' нигде не вызывается'));
}

group('Правила человеческого текста');
{
  // блок должен попасть во все четыре режима генерации статьи
  const n = (js.match(/\$\{HUMANIZER\}/g) || []).length;
  n === 4 ? ok('HUMANIZER подставлен во все 4 режима') : fail(`HUMANIZER подставлен ${n} раз вместо 4`);
  js.includes('${HUMANIZER_SHORT}') ? ok('короткий свод есть в промпте пинов') : fail('в промпте пинов нет правил');
  /const HUMANIZER=`/.test(js) ? ok('сам блок правил на месте') : fail('блок HUMANIZER не найден');
}

group('Интерфейс');
{
  // Здесь однажды уже была поломка: функция панели существовала, а кнопки, которая её
  // вызывает, не было нигде, и до панели нельзя было добраться. Эта проверка её не пропустит.
  const handlers = [...body.matchAll(/\bon(?:click|change|input)="([^"]+)"/g)]
    // (?<![.\w$]) — чтобы document.getElementById() не считалось вызовом getElementById
    .flatMap(m => [...m[1].matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)].map(x => x[1]));
  const called = [...new Set(handlers)].filter(n => !['this', 'ST'].includes(n));
  const undefinedFns = called.filter(n =>
    !new RegExp(`(function|const|let|var)\\s+${n}\\b`).test(js) && !(n in globalThis));
  undefinedFns.length
    ? fail('обработчики без функции: ' + undefinedFns.join(', '))
    : ok(`${called.length} обработчиков в разметке, все функции определены`);

  ['openReview', 'openBatch', 'openSettings'].forEach(fn =>
    body.includes(fn + '()') ? ok(`${fn}() доступен из интерфейса`) : fail(`до ${fn}() нельзя добраться из интерфейса`));
}

console.log(bad ? `\nПРОВЕРКА НЕ ПРОШЛА: ошибок — ${bad}` : '\nПроверка пройдена.');
process.exit(bad ? 1 : 0);
