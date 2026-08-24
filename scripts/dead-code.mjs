// Разовый обзор: какие функции определены, но нигде не вызываются.
// Так нашлась поломка с недоступной панелью: функция существовала,
// а кнопки, которая её вызывает, не было ни в разметке, ни в коде.
import { readFileSync, readdirSync } from 'node:fs';

const body = readFileSync('src/app/body.html', 'utf8');
const js = readdirSync('src/app/js').sort()
  .map(f => readFileSync('src/app/js/' + f, 'utf8')).join('\n');

const defined = [...js.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);

const dead = defined.filter(name => {
  const call = new RegExp('(?<![.\\w$])' + name + '\\s*\\(', 'g');
  const usesInJs = (js.match(call) || []).length;   // 1 = только само определение
  return usesInJs <= 1 && !new RegExp('(?<![.\\w$])' + name + '\\s*\\(').test(body);
});

console.log('функций всего:', defined.length);
console.log(dead.length
  ? 'нигде не вызываются (' + dead.length + '):\n  ' + dead.join('\n  ')
  : 'все функции где-то вызываются');
