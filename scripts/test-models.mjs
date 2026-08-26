// Проверка выпадающего списка текстовых моделей: заполняется из аккаунта Runware,
// переживает отсутствие списка, восстанавливает сохранённый выбор и не теряет его,
// если модель из списка пропала.
import { readFileSync } from 'node:fs';

const src = readFileSync('src/app/js/04-claude.js', 'utf8');
const grab = (start, end) => {
  const a = src.indexOf(start); const b = src.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error('не найдено: ' + start);
  return src.slice(a, b + end.length);
};
const code = grab('const FALLBACK_LLMS=', '\n}\n\n// GPT-5.6 Luna');

// простейшая заглушка select и input
const el = () => ({ value: '', innerHTML: '', style: {} });
const build = ({ saved = null, response = null } = {}) => {
  const nodes = { textModel: el(), textModelId: el(), textModelIdRow: el() };
  const store = saved == null ? '{}' : JSON.stringify({ textModel: saved });
  const api = new Function('nodes', 'store', 'response', `
    const $ = id => nodes[id] || null;
    const v = id => (nodes[id] ? nodes[id].value : '') || '';
    const esc = s => String(s == null ? '' : s);
    const localStorage = { getItem: () => store };
    const fetch = async () => response
      ? { ok: true, json: async () => response }
      : { ok: false, json: async () => ({}) };
    ${code}
    return { loadTextModels, textModel, toggleCustomModel, FALLBACK_LLMS };
  `)(nodes, store, response);
  return { nodes, ...api };
};

const optionValues = html => [...html.matchAll(/<option value="([^"]*)"/g)].map(m => m[1]);

let bad = 0;
const check = (n, c) => { console.log((c ? '  ✓ ' : '  ✗ ') + n); if (!c) bad++; };

console.log('Список пришёл из аккаунта');
{
  const k = build({ response: { data: [
    { id: 'openai:gpt@5.6-luna', name: 'GPT-5.6 Luna' },
    { id: 'minimax:m2.7@0', name: 'MiniMax M2.7' },
  ] } });
  await k.loadTextModels();
  const vals = optionValues(k.nodes.textModel.innerHTML);
  check('Claude первым', vals[0] === 'claude');
  check('модели из аккаунта на месте', vals.includes('openai:gpt@5.6-luna') && vals.includes('minimax:m2.7@0'));
  check('ручной ввод последним', vals.at(-1) === 'custom');
  check('видны человеческие названия', /MiniMax M2\.7/.test(k.nodes.textModel.innerHTML));
  check('поле ввода спрятано', k.nodes.textModelIdRow.style.display === 'none');
}

console.log('Списка нет');
{
  const k = build({});
  await k.loadTextModels();
  const vals = optionValues(k.nodes.textModel.innerHTML);
  check('остаётся известная модель', vals.includes('openai:gpt@5.6-luna'));
  check('и ручной ввод', vals.includes('custom'));
  check('приложение не остаётся без выбора', vals.length === 3);
}

console.log('Сохранённый выбор восстанавливается');
{
  const k = build({ saved: 'minimax:m2.7@0', response: { data: [{ id: 'minimax:m2.7@0', name: 'MiniMax M2.7' }] } });
  await k.loadTextModels();
  check('выбор вернулся', k.nodes.textModel.value === 'minimax:m2.7@0');
  check('и используется при генерации', k.textModel() === 'minimax:m2.7@0');
}

console.log('Сохранённая модель пропала из списка');
{
  const k = build({ saved: 'openai:gpt@5.5-old', response: { data: [{ id: 'minimax:m2.7@0', name: 'MiniMax M2.7' }] } });
  await k.loadTextModels();
  check('переключились на ручной ввод', k.nodes.textModel.value === 'custom');
  check('прежний идентификатор подставлен', k.nodes.textModelId.value === 'openai:gpt@5.5-old');
  check('поле показано', k.nodes.textModelIdRow.style.display === '');
  check('генерация пойдёт по нему', k.textModel() === 'openai:gpt@5.5-old');
}

console.log('Claude остаётся Claude');
{
  const k = build({ saved: 'claude', response: { data: [{ id: 'minimax:m2.7@0' }] } });
  await k.loadTextModels();
  check('выбран Claude', k.textModel() === 'claude');
}

console.log(bad ? '\nЕСТЬ ПРОБЛЕМЫ' : '\nвыпадающий список моделей работает как задумано');
process.exit(bad ? 1 : 0);
