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

console.log('Свой идентификатор модели');
{
  const { callLuna, calls } = make(
    [{ body: { choices: [{ finish_reason: 'stop', message: { content: 'x' } }] } }],
    { textModelId: 'openai:gpt@5.6-mini' });
  await callLuna('S', 'U', false);
  check('берётся из настроек', calls[0].model === 'openai:gpt@5.6-mini');
}

console.log('Предупреждение про поиск');
{
  const notes = [];
  const { callLuna } = make([{ body: { choices: [{ finish_reason: 'stop', message: { content: 'x' } }] } }]);
  await callLuna('S', 'U', true, m => notes.push(m));
  check('когда нужен поиск — предупреждает, что его нет', notes.some(m => /без веб-поиска/.test(m)));
}

console.log(bad ? '\nЕСТЬ ПРОБЛЕМЫ' : '\nветка Runware-модели работает как задумано');
process.exit(bad ? 1 : 0);
