// Одноразовый скрипт: режет app.js на модули по его собственным секциям-баннерам.
// Порядок склейки в build.mjs = порядок здесь, поэтому результат байт-в-байт равен оригиналу.
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const lines = readFileSync('src/app/js/app.js', 'utf8').split('\n');

// [имя файла, первая строка секции (1-based)]
const parts = [
  ['01-presets.js',         1],
  ['02-state-settings.js',  177],
  ['03-runware.js',         241],
  ['04-claude.js',          360],
  ['05-research.js',        454],
  ['06-style-ref.js',       510],
  ['07-article-core.js',    610],
  ['08-mode-ideas.js',      649],
  ['09-mode-recipes.js',    693],
  ['10-mode-prompts.js',    812],
  ['11-internal-links.js',  1213],
  ['12-images-pins.js',     1328],
  ['13-preview.js',         1425],
  ['14-wp-publish.js',      1669],
  ['15-csv-bank.js',        2070],
  ['16-batch.js',           2182],
  ['17-review.js',          2530],
  ['18-init.js',            2833],
];

const chunks = parts.map(([name, start], i) => {
  const end = i + 1 < parts.length ? parts[i + 1][1] - 1 : lines.length;
  return [name, lines.slice(start - 1, end).join('\n')];
});

// главная проверка: склейка обратно должна дать ровно исходный файл
const rejoined = chunks.map(([, t]) => t).join('\n');
if (rejoined !== lines.join('\n')) throw new Error('склейка не совпала с оригиналом');

for (const [name, text] of chunks) {
  writeFileSync('src/app/js/' + name, text, 'utf8');
  console.log(String(text.split('\n').length).padStart(5), 'строк →', name);
}
unlinkSync('src/app/js/app.js');
console.log('\nсклейка идентична оригиналу ✓');
