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

group('Печатные листы');
{
  // Ответы печатались там, где их быть не должно, и с заглушками вида [answer].
  js.includes('FIRST DECIDE WHETHER THE SHEET SHOULD HAVE A KEY AT ALL')
    ? ok('правило "нужен ли ключ вообще" на месте') : fail('нет правила о том, когда ключ не нужен');
  js.includes('NEVER PRINT A PLACEHOLDER') && js.includes('NEVER PRINT A HALF-REAL KEY')
    ? ok('запрет заглушек и половинчатых ключей на месте') : fail('нет запрета заглушек в ключе');

  // Три режима работы с референсом должны быть согласованы: список, разбор и правило.
  // два списка (сайдбар и панель пакета), в каждом одни и те же три варианта
  const modeOpts = body.match(/<option value="(image|motifs|style)"/g) || [];
  const distinct = new Set(modeOpts).size;
  distinct === 3 && modeOpts.length === 6
    ? ok('оба списка режимов референса предлагают все три варианта')
    : fail(`вариантов ${modeOpts.length} (различных ${distinct}) — ожидали 6 в двух списках`);
  // Панель пакета перекрывает сайдбар, поэтому режим должен быть доступен и оттуда.
  body.includes('id="bzRefMode"') && body.includes('setRefMode(this.value)')
    ? ok('режим референса доступен и из панели пакета') : fail('из панели пакета до режима референса не добраться');
  // три места читают референс; вызовы без аргумента берут режим из контекста, с аргументом — явный
  const sysCalls = (js.match(/styleVisionSys\(/g) || []).length - 1;   // минус само определение
  sysCalls === 3 ? ok('разбор референса везде выбирается по режиму') : fail(`styleVisionSys() вызван ${sysCalls} раз вместо 3`);

  // режим должен быть выбираем построчно, а не только на весь пакет
  // разметка строки рисуется из JS, поэтому ищем там
  js.includes("updRow('${r.id}','refMode',this.value)") && js.includes('batch default')
    ? ok('режим референса выбирается в каждой строке, с запасным значением пакета')
    : fail('в строке пакета нет выбора режима');
  /if\(mode==='motifs'\) return MOTIF_ORIGINALITY;/.test(js)
    ? ok('режим с переносом персонажей подключён') : fail('режим motifs не влияет на правило originality');

  // Промпт должен быть виден и правим везде, где есть кнопка Regenerate. Функция правки
  // в очереди ревью однажды уже пролежала без дела, не подключённая ни к чему.
  // Режим Ideas: фотографии идут от абзаца, нумерации внутри статьи нет.
  js.includes('SHOT_FRAMINGS') && !js.includes('SHOT_TYPES')
    ? ok('ракурсы задают только кадр, а не сюжет') : fail('вернулся список «мест на празднике» вместо ротации кадров');
  /ideaNo\+\+|\+\+ideaNo|ideaNo:\s*\(?i\+1/.test(js)
    ? fail('внутри статьи снова нумеруются идеи') : ok('идеи внутри статьи не нумеруются');
  js.includes('g.extraImagePrompts=[];')
    ? ok('дополнительных кадров у идеи не создаётся') : fail('вернулись дополнительные кадры к идеям');

  // В карточке-подсказке был блок с названиями игр — в статье об идеях он читался как чужой.
  (js.match(/label:'Games that fit'/g) || []).length === 0 && js.includes("!/\\bgames?\\b/i.test(String(x.label))")
    ? ok('блока с играми в карточке нет, старые статьи из очереди тоже чистятся')
    : fail('в карточке снова появился блок с играми');

  // Карточка-подсказка должна быть исключением, а не обязательной врезкой на каждой идее.
  js.includes('MOST IDEAS GET NO CARD') && js.includes('the DEFAULT is not to have one')
    ? ok('карточка-подсказка не обязательна') : fail('карточка-подсказка снова навязывается каждой идее');
  js.includes('roughly one idea in five should have no card')
    ? fail('вернулось правило «одна из пяти без карточки» — это и делало её обязательной') : ok('старое правило про одну из пяти убрано');

  js.includes('function promptBox(') ? ok('редактор промпта есть') : fail('редактора промпта нет');
  const wired = ['setGamePrompt(', 'setGameExtraPrompt(', 'reviewEditPrompt(', 'reviewEditExtraPrompt(']
    .filter(fn => (js.match(new RegExp(fn.replace('(', '\\('), 'g')) || []).length >= 2);
  wired.length === 4
    ? ok('промпт правится и в статье, и в очереди ревью, включая дополнительные кадры')
    : fail('не подключены: ' + ['setGamePrompt(', 'setGameExtraPrompt(', 'reviewEditPrompt(', 'reviewEditExtraPrompt(']
        .filter(f => !wired.includes(f)).join(', '));
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
