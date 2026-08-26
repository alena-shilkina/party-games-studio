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

  ['/api/claude', '/api/runware', '/api/llm', '/api/pexels', '/api/wp', '/api/keys'].forEach(r =>
    js.includes(r) ? ok('используется ' + r) : fail('маршрут ' + r + ' нигде не вызывается'));
}

group('Правила человеческого текста');
{
  // свод должен попасть во все четыре режима генерации статьи
  const n = (js.match(/\$\{voiceRules\(\)\}/g) || []).length;
  n === 4 ? ok('свод правил подставлен во все 4 режима') : fail(`свод правил подставлен ${n} раз вместо 4`);
  js.includes('${HUMANIZER_SHORT}') ? ok('короткий свод есть в промпте пинов') : fail('в промпте пинов нет правил');
  /const HUMANIZER=`/.test(js) ? ok('блок запретов на месте') : fail('блок HUMANIZER не найден');
  /const RCG_VOICE=`/.test(js) ? ok('голос Red Cheeks Girl на месте') : fail('блок RCG_VOICE не найден');
  /const VOICE_EXAMPLES=`/.test(js) ? ok('образцы «модель пишет / мы публикуем» на месте') : fail('образцов нет');
  ['one woman planning one specific thing', 'GET TO THE SUBSTANCE IN TWO SENTENCES',
   'BE SPECIFIC OR SAY NOTHING', 'NO EXCLAMATION MARKS', '150 to 155 characters']
    .forEach(s => js.includes(s) ? ok(`правило «${s.slice(0, 34)}» дошло до промпта`)
                                 : fail(`правило «${s.slice(0, 34)}» потерялось`));

  // Голос важнее списка запретов, и порядок это должен показывать: сначала голос,
  // сразу за ним образцы того же голоса, и только потом проверочный лист. Когда список
  // стоял вторым и объявлял себя главнее стиля, модель писала осторожно и никак.
  /return RCG_VOICE\+'\\n\\n'\+VOICE_EXAMPLES\+'\\n\\n'\+HUMANIZER;/.test(js)
    ? ok('порядок свода: голос, образцы, потом запреты') : fail('порядок свода снова ставит запреты перед образцами');
  js.includes('this list and the voice ever seem to disagree, the voice wins')
    ? ok('при споре запретов с голосом побеждает голос') : fail('список запретов снова объявляет себя главнее голоса');
  !js.includes('these override any other style guidance')
    ? ok('запреты больше не перебивают стиль') : fail('запреты снова перебивают весь стиль');

  // Голос стоит в начале, а схема JSON за тысячи токенов ниже, вплотную к выдаче.
  // Без возврата в самом конце модель пишет, глядя на формат, и голоса не видно.
  const lastN = (js.match(/\$\{VOICE_LAST\}/g) || []).length;
  lastN === 4 ? ok('возврат к голосу стоит в конце всех 4 промптов')
              : fail(`возврат к голосу подставлен ${lastN} раз вместо 4`);
  /const VOICE_LAST=`/.test(js) ? ok('блок возврата к голосу на месте') : fail('блока VOICE_LAST нет');

  // Правила формата не должны спорить с голосом: раньше они требовали meta до 120 знаков
  // и вступление в два абзаца, стояли ближе к схеме и побеждали.
  !js.includes('under 120 chars')
    ? ok('длина meta нигде не спорит с голосом') : fail('где-то осталось требование meta до 120 знаков');
  !js.includes('intro: 2 short paragraphs')
    ? ok('вступление нигде не требует двух абзацев') : fail('вступление снова требует 2 абзаца вместо 2-4 фраз');
  !js.includes('scroll depth and qualifying ad slots')
    ? ok('модели не сказано писать ради длины') : fail('модели снова сказано набирать объём под рекламу');

  // Хвост-напоминание нужен только моделям послабее: Клод держит инструкцию целиком.
  js.includes('${voiceReminder()}')
    ? ok('напоминание уходит в конец сообщения') : fail('напоминания в конце сообщения нет');
  /function weakTextModel\(\)/.test(js) && js.includes("textModel()!=='claude'")
    ? ok('напоминание включается только для не-Клода') : fail('нет условия по модели');

  // Промпт запрещает длинные тире и сам не должен их содержать: модель послабее
  // копирует пунктуацию образца, а не только его смысл. Считаем только текст внутри
  // обратных кавычек в файлах промптов: в русских комментариях и в интерфейсе тире уместно,
  // а «(—)» в самом запрете оставлено намеренно как пример символа.
  const PROMPT_FILES = ['07-article-core.js', '07a-humanizer.js', '08-mode-ideas.js',
    '09-mode-recipes.js', '10-mode-prompts.js', '11-internal-links.js', '12-images-pins.js'];
  let stray = 0;
  for (const f of PROMPT_FILES) {
    const s = readFileSync('src/app/js/' + f, 'utf8');
    let inTpl = false, inLine = false, inBlock = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i], n2 = s[i + 1];
      if (c === '\n') { inLine = false; continue; }
      if (inLine) continue;
      if (inBlock) { if (c === '*' && n2 === '/') { inBlock = false; i++; } continue; }
      if (!inTpl && c === '/' && n2 === '/') { inLine = true; i++; continue; }
      if (!inTpl && c === '/' && n2 === '*') { inBlock = true; i++; continue; }
      if (c === '`' && s[i - 1] !== '\\') { inTpl = !inTpl; continue; }
      if (inTpl && c === '—' && !(s[i - 1] === '(' && s[i + 1] === ')')) stray++;
    }
  }
  stray === 0 ? ok('в промптах нет длинных тире') : fail(`длинных тире в промптах: ${stray}`);
}

group('Настройка модели Runware');
{
  // Не отправлялось ни одной ручки сэмплинга, модель работала на дефолте и писала ровно.
  /const LUNA_TEMP=/.test(js) && js.includes('body.temperature=LUNA_TEMP')
    ? ok('температура уходит в запрос') : fail('температура не задаётся');
  js.includes('body.top_p=LUNA_TOP_P') ? ok('topP уходит в запрос') : fail('topP не задаётся');
  // Luna отвечает 400 на любую temperature кроме единицы. Ручки обязаны отключаться сами.
  /sampling=false; LUNA_SAMPLING=false;/.test(js)
    ? ok('модель без ручек сэмплинга обслуживается повтором') : fail('отказ от temperature уронит статью');
  /LUNA_SEARCH_OK=false;/.test(js)
    ? ok('недоступный веб-поиск отключается на сессию') : fail('неудачный поиск будет повторяться в каждой статье');

  // Веб-поиск есть только в родном API Runware, и путь к нему обязан быть с откатом.
  js.includes("tools:[{type:'search'}]") ? ok('веб-поиск запрашивается') : fail('веб-поиск не запрашивается');
  js.includes("fetch('/api/llm/native'") ? ok('родной путь подключён') : fail('родного пути нет');
  /catch\(e\)\{[\s\S]{0,200}без веб-поиска/.test(js)
    ? ok('осечка родного пути откатывается на обычный') : fail('нет отката, статья умрёт на осечке');

  // Из-за списка запретов модель понимала задачу как «пиши короче».
  js.includes('None of the rules above ask you to write LESS')
    ? ok('в хвосте сказано, что короче писать не просили') : fail('хвост снова читается как просьба сократить');
  js.includes('An opinion in every entry is required, not optional')
    ? ok('мнение в каждом пункте обязательно') : fail('мнение снова необязательно');
  js.includes('That is a rulebook, not a blog')
    ? ok('назван сам провал: инструкция вместо текста') : fail('провал не назван');
}

group('Текст после генерации');
{
  // Механические правила выполняются без модели, иначе они держатся на удаче.
  ['function cleanCopyText(', 'function cleanCopy(', 'function copyFindings(']
    .forEach(f => js.includes(f) ? ok(`${f.slice(9, -1)}() на месте`) : fail(`нет ${f.slice(9, -1)}()`));
  js.includes('const fixed=cleanCopy(art);')
    ? ok('подчистка вызывается после разбора ответа') : fail('подчистка не вызывается при генерации');
  js.includes('ST.copyNotes=briefNotes.concat(copyFindings(art));')
    ? ok('замечания по брифу и по статье собираются вместе') : fail('замечания не собираются');
  js.includes('${copyNotesHTML()}')
    ? ok('замечания видны в превью') : fail('замечания негде увидеть');
  js.includes("COPY_SKIP_KEYS=['url'")
    ? ok('ссылки и slug при подчистке не трогаются') : fail('подчистка может испортить ссылки');

  // Бриф стоит в сообщении ближе к задаче, чем системный промпт, и копируется охотнее всего.
  js.includes("const brief=cleanCopyText(v('context')||'');")
    ? ok('бриф чистится перед подстановкой в промпт') : fail('бриф уходит в промпт как есть');
  js.includes("copyFindings({brief}).map(") && js.includes("'в брифе: '")
    ? ok('штампы в брифе видны отдельной строкой') : fail('штампы в брифе не проверяются');
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
  const modeOpts = body.match(/<option value="(image|motifs)"/g) || [];
  const distinct = new Set(modeOpts).size;
  distinct === 2 && modeOpts.length === 4
    ? ok('оба списка режимов референса предлагают оба варианта')
    : fail(`вариантов ${modeOpts.length} (различных ${distinct}) — ожидали 4 в двух списках`);
  // список в строке пакета рисуется из JS, поэтому смотрим и туда
  body.includes('value="style"') || js.includes("l:'Style text only'")
    ? fail('режим «только текст» вернулся в интерфейс') : ok('режима «только текст» больше нет нигде');
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
  js.includes("==='motifs' ? MOTIF_ORIGINALITY : REF_ORIGINALITY")
    ? ok('режим с переносом персонажей подключён') : fail('режим motifs не влияет на правило originality');
  js.includes('if(!sheetRef()) return ORIGINALITY;')
    ? ok('без референса в промпт не идёт инструкция про приложенную картинку')
    : fail('правило рисования не проверяет, есть ли референс');

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

  // Своего встроенного стиля у приложения быть не должно: он приносил ботанику
  // и вензеля по углам. Стиль задаёт только приложенный референс.
  !js.includes('const INFO_STYLES=') && !js.includes('const WATERCOLOUR_SHEET=')
    ? ok('встроенного стиля печатных листов нет') : fail('вернулся встроенный стиль или список пресетов');
  /function styleText\(\)\{\s*return \(v\('styleBlock'\)\|\|ST\.styleBlock\|\|''\)\.trim\(\);/.test(js)
    ? ok('стиль берётся только из референса') : fail('styleText снова подмешивает что-то своё');
  js.includes("const rich=(sb && !minimal")
    ? ok('декоративная система требуется только вместе с контрактом')
    : fail('RICH_SHEET снова просит украшения там, где контракта нет');
  js.includes('const BACKGROUND_RULE=') && js.includes('NOT sit on yellow, cream, ivory, beige, butter, sand, tan')
    ? ok('тёплый фон запрещён') : fail('запрет тёплого фона пропал');
  (js.match(/BACKGROUND_RULE/g) || []).length >= 3
    ? ok('запрет фона добавляется и с референсом, и без него') : fail('запрет фона применяется не во всех ветках');
  const refUses = (js.match(/g\.asset==='illustration'\?null:sheetRef\(\)/g) || []).length;
  refUses === 4 ? ok('все четыре места рисования листа берут референс из одного источника')
                : fail(`sheetRef() используется ${refUses} раз вместо 4`);
  js.includes('styleRef:sheetRef()||null')
    ? ok('снимок ревью уносит тот же референс') : fail('снимок ревью не сохраняет референс');

  // Одна сборка промпта на все случаи. У очереди ревью был свой порядок — стиль ПОСЛЕ
  // описания листа, — и перерисованный лист уезжал от набора.
  js.includes('withStyle(g.imagePrompt||(\'printable \'+g.name), g.asset, s.styleBlock, footer)')
    ? ok('перерисовка из ревью использует общую сборку промпта') : fail('очередь ревью снова собирает промпт по-своему');
  js.includes('THE SHEET DESCRIPTION IS CONTENT, NOT STYLE')
    ? ok('замок стиля перебивает стилевые слова из описания листа') : fail('замок стиля не защищён от стилевых слов в описании');
  js.includes('clean printable game page')
    ? fail('в инструкции снова просят «clean» — это уводит листы в белую графику') : ok('из инструкции убрано слово, тянувшее в белую графику');

  // Референс разбирается ПОДРОБНО: техника, палитра с кодами, рамка, мотивы, шрифт.
  // Попытка сузить его до одной техники себя не оправдала — набор расходился.
  js.includes('exact palette — name every key colour with an approximate hex code')
    ? ok('референс описывается с палитрой и кодами цветов') : fail('из разбора референса пропала палитра');
  js.includes('the border / frame treatment') && js.includes('typography character')
    ? ok('референс описывает рамку и шрифт') : fail('из разбора референса пропали рамка или шрифт');
  js.includes('TECHNIQUE CONTRACT')
    ? fail('вернулся урезанный разбор «только техника»') : ok('разбор референса полный, не урезанный');
  js.includes('RECURRING CHARACTERS — name the actual creatures')
    ? ok('режим с персонажами называет героев конкретно') : fail('режим с персонажами потерял описание героев');
  // Листы рисуются разными запросами, поэтому единство держится только на тексте замка:
  // общего «в одном стиле» мало, нужен поимённый список.
  ['THE HAND:', 'THE TYPE:', 'THE COLOURS:', 'THE FRAME:', 'THE MOTIFS:'].every(x => js.includes(x))
    ? ok('замок перечисляет поимённо: рука, шрифты, цвет, рамка, мотивы')
    : fail('замок стиля снова требует единства «в общем», без перечисления');
  js.includes('the SAME two typefaces throughout')
    ? ok('шрифты явно требуются одинаковыми') : fail('нет требования одинаковых шрифтов');

  // Люди в рисованном стиле разрешены, на фотографиях — нет: там видна искусственность.
  js.includes('People, children and animals ARE allowed here')
    ? ok('люди на печатных листах разрешены') : fail('люди на печатных листах снова запрещены');
  js.includes('- NO people, no hands, no faces.')
    ? ok('на фотографиях людей по-прежнему нет') : fail('запрет людей на фотографиях пропал');
  js.includes('const HOME_KITCHEN=') && js.includes("v('articleMode')==='recipes'")
    ? ok('рецепты снимаются как домашнее фото, а не студийное') : fail('нет домашнего фотоконтракта для рецептов');

  // Вторая модель для текста: переключатель, своя ветка вызова и тот же ключ Runware.
  body.includes('id="textModel"') && body.includes('id="textModelId"')
    ? ok('модель текста переключается и её id правится') : fail('нет переключателя модели текста');
  js.includes('function callLuna(') && js.includes("textModel()!=='claude'")
    ? ok('вторая модель подключена к генерации статьи') : fail('вторая модель не вызывается');
  js.includes('function loadTextModels(') && js.includes("fetch('/api/llm/models')")
    ? ok('список моделей подтягивается из аккаунта') : fail('список моделей не подтягивается');
  js.includes('const FALLBACK_LLMS=') && js.includes("value=\"custom\">Other")
    ? ok('без списка остаются известная модель и ручной ввод') : fail('нет запасного варианта для списка моделей');
  !/<option value="luna"/.test(body)
    ? ok('в разметке нет зашитых идентификаторов моделей') : fail('идентификатор модели снова зашит в разметку');

  // Стоимость статьи: картинки точные, текст — оценка по токенам.
  js.includes('costAddImage(item.cost)') && js.includes('includeCost:true')
    ? ok('точная цена картинок берётся из ответа Runware') : fail('цена картинок не считается');
  (js.match(/costAddText\(/g) || []).length >= 3
    ? ok('токены текста считаются у обеих моделей') : fail('токены текста считаются не везде');
  (js.match(/r\.cost=costSummary\(\)/g) || []).length === 2
    ? ok('стоимость запоминается и в пакете, и при пересборе строки') : fail('стоимость сохраняется не во всех путях');
  body.includes('id="bzCost"') && js.includes('batchCostLine()')
    ? ok('итог по пакету показывается') : fail('нет итога по пакету');

  // Импорт CSV: режим и аудитория распознаются по смыслу, а не по точному совпадению,
  // и нераспознанное не проходит молча.
  js.includes('function normArticleMode(') && js.includes('function normAudience(')
    ? ok('режим и аудитория из CSV разбираются по смыслу') : fail('разбор CSV снова требует точного совпадения');
  js.includes('no article_mode column — everything is Games')
    ? ok('импорт сообщает, если колонки режима нет') : fail('импорт снова молчит про пропущенный режим');
  js.includes("col('article_mode','mode','article_type','type')")
    ? ok('заголовок колонки режима принимается в нескольких вариантах') : fail('колонка режима ищется только по одному имени');

  js.includes('function promptBox(') ? ok('редактор промпта есть') : fail('редактора промпта нет');
  const wired = ['setGamePrompt(', 'setGameExtraPrompt(', 'reviewEditPrompt(', 'reviewEditExtraPrompt(']
    .filter(fn => (js.match(new RegExp(fn.replace('(', '\\('), 'g')) || []).length >= 2);
  wired.length === 4
    ? ok('промпт правится и в статье, и в очереди ревью, включая дополнительные кадры')
    : fail('не подключены: ' + ['setGamePrompt(', 'setGameExtraPrompt(', 'reviewEditPrompt(', 'reviewEditExtraPrompt(']
        .filter(f => !wired.includes(f)).join(', '));
}

group('Домашний стиль печаток');
{
  // Без референса раньше не подставлялось ничего, и генератор рисовал по своему штампу:
  // акварельные цветы по углам. Домашний стиль занимает это место и прямо их запрещает.
  /const DEFAULT_SHEET_STYLE=`/.test(js) ? ok('домашний стиль на месте') : fail('домашнего стиля нет');
  js.includes('NO CORNER ORNAMENT')
    ? ok('цветы по углам запрещены прямым текстом') : fail('запрета на углы нет, цветы вернутся');
  ['floral spray', 'botanical wreath', 'eucalyptus branch', 'lavender stem'].forEach(w =>
    js.includes(w) ? ok(`«${w}» назван в запрете`) : fail(`«${w}» из запрета пропал`));
  js.includes('pale paper with a faint tooth')
    ? ok('светлая бумага с зерном задана') : fail('бумага не описана');
  js.includes('watercolour and gouache with real pigment behaviour')
    ? ok('акварель и гуашь названы') : fail('техника не названа');
  // фотографии этот стиль не касается: они уходят по ветке PHOTO_CONTRACT
  /if\(asset==='illustration'\)\{/.test(js)
    ? ok('фотографии по-прежнему идут своей веткой') : fail('фото могут получить стиль печаток');

  // PIN_VIBES удалён целиком: это был старый костыль, которым не пользовались
  ['PIN_VIBES', 'activeVibe', 'detectVibe', 'normVibe', 'isNeutralVibe', 'vibeIsFixed',
   'resolvedVibeName', 'currentVibeBlock', 'renderVibes', 'NO_SEASONAL'].forEach(n =>
    js.includes(n) ? fail(`${n} вернулся в код`) : ok(`${n} удалён`));
  body.includes('pinVibe') ? fail('поле Pin vibe вернулось в разметку') : ok('поля Pin vibe в разметке нет');
}

group('Фотографии');
{
  // Контракт жёстко задавал 50mm f/2.8 с размытым фоном, и это перебивало ротацию планов:
  // «весь предмет в своей обстановке» на f/2.8 не снимешь, поэтому все кадры выходили крупными.
  js.includes('DEPTH OF FIELD FOLLOWS THE FRAMING')
    ? ok('глубина резкости следует за планом') : fail('глубина резкости снова прибита к одному значению');
  js.includes('override any camera default')
    ? ok('план и свет перебивают дефолт камеры') : fail('дефолт камеры снова главнее плана');
  const shots = js.slice(js.indexOf('const SHOT_FRAMINGS=['), js.indexOf('];', js.indexOf('const SHOT_FRAMINGS=[')));
  const stops = [...shots.matchAll(/f\/([0-9.]+)/g)].map(m => m[1]);
  stops.length >= 8 ? ok(`диафрагма задана во всех ${stops.length} планах`) : fail('не у всех планов есть диафрагма');
  stops.filter(s => s === '2.8').length <= 1
    ? ok('крупный план ровно один из восьми') : fail('крупных планов снова большинство');
  stops.some(s => s === '8') ? ok('общий план стоит на f/8') : fail('общего плана с f/8 нет');
  /WIDE ESTABLISHING SHOT/.test(js) && /PULLED-BACK VIEW/.test(js)
    ? ok('общий и отъехавший планы на месте') : fail('планов с обстановкой нет');

  // Света был ровно один: мягкий рассеянный из окна. Отсюда несолнечные и непраздничные кадры.
  const light = js.slice(js.indexOf('const SHOT_LIGHT=['), js.indexOf('];', js.indexOf('const SHOT_LIGHT=[')));
  (light.match(/sun/gi) || []).length >= 4
    ? ok('солнце есть в нескольких вариантах света') : fail('солнца в ротации света почти нет');
  (light.match(/overcast/gi) || []).length <= 1
    ? ok('пасмурный свет только один вариант из восьми') : fail('пасмурный свет снова доминирует');
  js.includes('Soft overcast light is ONE option among several, not the default')
    ? ok('мягкий рассеянный больше не по умолчанию') : fail('мягкий рассеянный снова по умолчанию');
  js.includes('A dim kitchen is the wrong picture')
    ? ok('тусклая кухня в рецептах запрещена') : fail('домашний кухонный блок снова уводит в полумрак');
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

  // Шапка пакетной панели: два ряда, и они не должны раздуваться.
  // Колонка с flex-wrap:wrap раскладывала ряды по вертикали и растягивала панель
  // с 190 до 414 пикселей на узком экране; сетка без align-content:start делала то же
  // с рядами внутри. Оба раза внешне это выглядело как «кнопки расплылись по панели».
  const css = readFileSync('src/app/styles.css', 'utf8');
  /.bz-top.stacked{[^}]*flex-wrap:nowrap/.test(css)
    ? ok('шапка-колонка не переносит ряды') : fail('у .bz-top.stacked снова нет flex-wrap:nowrap — шапка растянется');
  /.bz-row-ctl{[^}]*align-content:start/.test(css)
    ? ok('сетка управления не растягивает ряды') : fail('у .bz-row-ctl нет align-content:start — ряды сетки растянутся');
  ['bz-row-main', 'bz-row-ctl'].forEach(cl =>
    body.includes(cl) ? ok(`ряд .${cl} на месте`) : fail(`ряда .${cl} нет в разметке`));

  ['openReview', 'openBatch', 'openSettings'].forEach(fn =>
    body.includes(fn + '()') ? ok(`${fn}() доступен из интерфейса`) : fail(`до ${fn}() нельзя добраться из интерфейса`));
}

console.log(bad ? `\nПРОВЕРКА НЕ ПРОШЛА: ошибок — ${bad}` : '\nПроверка пройдена.');
process.exit(bad ? 1 : 0);
