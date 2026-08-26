// Проверка ветки для текстовых моделей Runware. Настоящий запрос стоил бы денег,
// поэтому подсовываем ответы вместо fetch и смотрим, что callLuna их правильно разбирает:
// достаёт текст, продолжает обрезанный ответ, повторяет попытку при перегрузке
// и внятно падает на ошибке.
import { readFileSync } from 'node:fs';

const src = readFileSync('src/app/js/04-claude.js', 'utf8');
const grab = (start, end) => {
  const a = src.indexOf(start); const b = src.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error('не найдено: ' + start);
  return src.slice(a, b + end.length);
};
const fn = grab('async function callLuna(', "\n  throw new Error(model+': too many continuations');\n}");

const make = (responses, fields = {}) => {
  const calls = [];
  const body = o => ({ ok: true, status: 200, json: async () => o });
  const ctx = new Function('responses', 'calls', 'fields', `
    const v = id => (fields[id] || '');
    let batchStopped = false, batchAbort = null;
    const costAddText = (a, b, c) => calls.usage = { in: a, out: b, exact: c };
    const textModel = () => fields.textModelId || 'openai:gpt@5.6-luna';
    let LAST_TOKEN_FIELD = 'max_completion_tokens';
    const LUNA_TEMP = 1.05, LUNA_TOP_P = 0.95;
    // путь с веб-поиском подменяем: тест решает, отвечает он или падает
    const lunaSearchOnce = async () => {
      if (!fields.__search) throw new Error('native path unavailable');
      calls.push({ __native: true });
      return fields.__search;
    };
    const fetch = async (url, opt) => { calls.push(JSON.parse(opt.body)); const r = responses.shift();
      return { ok: r.ok !== false, status: r.status || 200, json: async () => r.body }; };
    const setTimeout_ = setTimeout;
    ${fn}
    return callLuna;
  `)(responses, calls, fields);
  return { callLuna: ctx, calls };
};

let bad = 0;
const check = (n, c) => { console.log((c ? '  ✓ ' : '  ✗ ') + n); if (!c) bad++; };

console.log('Обычный ответ');
{
  const { callLuna, calls } = make([{ body: { choices: [{ finish_reason: 'stop', message: { content: '{"title":"ok"}' } }] } }]);
  const out = await callLuna('SYSTEM', 'USER', false);
  check('текст извлечён', out === '{"title":"ok"}');
  check('модель по умолчанию — Luna', calls[0].model === 'openai:gpt@5.6-luna');
  check('system ушёл отдельным сообщением', calls[0].messages[0].role === 'system' && calls[0].messages[0].content === 'SYSTEM');
  check('user на месте', calls[0].messages[1].role === 'user' && calls[0].messages[1].content === 'USER');
}

console.log('Обрезанный ответ продолжается');
{
  const { callLuna, calls } = make([
    { body: { choices: [{ finish_reason: 'length', message: { content: '{"title":"very ' } }] } },
    { body: { choices: [{ finish_reason: 'stop',   message: { content: 'long"}' } }] } },
  ]);
  const out = await callLuna('S', 'U', false);
  check('куски склеены', out === '{"title":"very long"}');
  check('во втором запросе есть просьба продолжить', /Continue the JSON from exactly where you stopped/.test(calls[1].messages.at(-1).content));
  check('предыдущий кусок передан модели', calls[1].messages.some(m => m.role === 'assistant' && m.content === '{"title":"very '));
}

console.log('Ошибки');
{
  const { callLuna } = make([{ ok: false, status: 401, body: { error: { message: 'Invalid API key' } } }]);
  let msg = ''; try { await callLuna('S', 'U', false); } catch (e) { msg = e.message; }
  check('ошибка провайдера показывается как есть', msg === 'Invalid API key');
}
{
  // Worker на медленном пути отдаёт 200 с ошибкой внутри тела
  const { callLuna } = make([{ body: { error: { status: 402, message: 'Not enough credits' } } }]);
  let msg = ''; try { await callLuna('S', 'U', false); } catch (e) { msg = e.message; }
  check('ошибка из тела ответа тоже ловится', msg === 'Not enough credits');
}
{
  const { callLuna } = make([{ body: { choices: [] } }]);
  let msg = ''; try { await callLuna('S', 'U', false); } catch (e) { msg = e.message; }
  check('пустой ответ не притворяется успехом', /empty response/.test(msg));
}

console.log('Имя поля с потолком ответа');
{
  const { callLuna, calls } = make([{ body: { choices: [{ finish_reason: 'stop', message: { content: 'x' } }] } }]);
  await callLuna('S', 'U', false);
  check('по умолчанию max_completion_tokens', 'max_completion_tokens' in calls[0] && !('max_tokens' in calls[0]));
}
{
  // модель отвечает 400 и прямо называет нужное поле — должны переключиться и повторить
  const { callLuna, calls } = make([
    { ok: false, status: 400, body: { error: { message: "Unsupported parameter: 'max_completion_tokens' is not supported with this model. Use 'max_tokens' instead." } } },
    { body: { choices: [{ finish_reason: 'stop', message: { content: 'ok' } }] } },
  ]);
  const out = await callLuna('S', 'U', false);
  check('повтор произошёл, ответ получен', out === 'ok');
  check('второй запрос ушёл с max_tokens', 'max_tokens' in calls[1] && !('max_tokens' in calls[1] && 'max_completion_tokens' in calls[1]));
}

console.log('Свой идентификатор модели');
{
  const { callLuna, calls } = make(
    [{ body: { choices: [{ finish_reason: 'stop', message: { content: 'x' } }] } }],
    { textModelId: 'openai:gpt@5.6-mini' });
  await callLuna('S', 'U', false);
  check('берётся из настроек', calls[0].model === 'openai:gpt@5.6-mini');
}

console.log('Токены уходят в счётчик стоимости');
{
  const { callLuna, calls } = make([{ body: {
    choices: [{ finish_reason: 'stop', message: { content: 'x' } }],
    usage: { prompt_tokens: 1234, completion_tokens: 567 } } }]);
  await callLuna('S', 'U', false);
  check('входные и выходные токены переданы', calls.usage && calls.usage.in === 1234 && calls.usage.out === 567);
}

console.log('Точная стоимость от провайдера');
{
  // Runware кладёт cost внутрь usage; раньше читали только верхний уровень и теряли её
  const { callLuna, calls } = make([{ body: {
    choices: [{ finish_reason: 'stop', message: { content: 'x' } }],
    usage: { prompt_tokens: 51, completion_tokens: 38, cost: 0.000134 } } }]);
  await callLuna('S', 'U', false);
  check('cost из usage подхвачен', calls.usage && calls.usage.exact === 0.000134);
}
{
  const { callLuna, calls } = make([{ body: {
    choices: [{ finish_reason: 'stop', message: { content: 'x' } }],
    usage: { prompt_tokens: 51, completion_tokens: 38 }, cost: 0.000222 } }]);
  await callLuna('S', 'U', false);
  check('cost с верхнего уровня тоже подхвачен', calls.usage && calls.usage.exact === 0.000222);
}
{
  const { callLuna, calls } = make([{ body: {
    choices: [{ finish_reason: 'stop', message: { content: 'x' } }],
    usage: { prompt_tokens: 51, completion_tokens: 38 } } }]);
  await callLuna('S', 'U', false);
  check('без cost остаются одни токены', calls.usage && calls.usage.exact === undefined);
}

console.log('Настройки сэмплинга уходят в запрос');
{
  const { callLuna, calls } = make([{ body: { choices: [{ finish_reason: 'stop', message: { content: 'x' } }] } }]);
  await callLuna('S', 'U', false);
  check('температура задана', calls[0].temperature === 1.05);
  check('topP задан', calls[0].top_p === 0.95);
}

console.log('\nВеб-поиск и откат на обычный путь');
{
  // родной путь ответил — обычный запрос вообще не понадобился
  const notes = [];
  const { callLuna, calls } = make([], { __search: '{"title":"searched"}' });
  const out = await callLuna('S', 'U', true, m => notes.push(m));
  check('ответ пришёл из поиска', out === '{"title":"searched"}');
  check('обычный путь не дёргали', calls.length === 1 && calls[0].__native);
  check('пользователю сказано, что идёт поиск', notes.some(m => /ищет в вебе/.test(m)));
}
{
  // родной путь недоступен — молча возвращаемся на проверенный
  const notes = [];
  const { callLuna, calls } = make([{ body: { choices: [{ finish_reason: 'stop', message: { content: 'ok' } }] } }]);
  const out = await callLuna('S', 'U', true, m => notes.push(m));
  check('статья всё равно написана', out === 'ok');
  check('запрос ушёл обычным путём', calls.some(c => c.model));
  check('предупредили, что поиска не было', notes.some(m => /без веб-поиска/.test(m)));
}

console.log(bad ? '\nЕСТЬ ПРОБЛЕМЫ' : '\nветка Runware-модели работает как задумано');
process.exit(bad ? 1 : 0);
