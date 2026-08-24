// Одноразовый скрипт: разбирает скачанную с сайта страницу на исходники в src/app/.
// Заодно выкидывает то, что дописал Cloudflare при отдаче (шрифты /cf-fonts/,
// анти-бот скрипт) и лишний закрывающий </script>.
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('original-downloaded.html', 'utf8');

const cut = (openTag, from) => {
  const start = src.indexOf(openTag, from);
  if (start < 0) throw new Error('не найден ' + openTag + ' после ' + from);
  const close = openTag.startsWith('<style') ? '</style>' : '</script>';
  const inner = start + openTag.length;
  const end = src.indexOf(close, inner);
  if (end < 0) throw new Error('не найден ' + close);
  return { start, inner, end, after: end + close.length, text: src.slice(inner, end) };
};

const cfFonts = cut('<style type="text/css">', 0);
const appCss  = cut('<style>', cfFonts.after);
const headEnd = src.indexOf('</head>', appCss.after);
const bodyOpen = src.indexOf('<body>', headEnd);
const scriptStart = src.indexOf('<script>', bodyOpen);
const mainJs = cut('<script>', bodyOpen);

// проверки, что разметка легла так, как мы думаем
const checks = {
  'cf-fonts внутри первого style': cfFonts.text.includes('/cf-fonts/'),
  'app css содержит переменные':   appCss.text.includes('--') && appCss.text.length > 5000,
  'js большой':                    mainJs.text.length > 200000,
  'js начинается с кода':          /^\s*(const|let|var|function|\/\/|\/\*)/.test(mainJs.text),
};
for (const [k, ok] of Object.entries(checks)) if (!ok) throw new Error('проверка не прошла: ' + k);

const headTop = src.slice(src.indexOf('<head>'), cfFonts.start);   // meta, title, favicon
const bodyHtml = src.slice(bodyOpen + '<body>'.length, scriptStart);

writeFileSync('src/app/head.html', headTop.trim() + '\n', 'utf8');
writeFileSync('src/app/styles.css', appCss.text.trim() + '\n', 'utf8');
writeFileSync('src/app/body.html', bodyHtml.trim() + '\n', 'utf8');
writeFileSync('src/app/js/app.js', mainJs.text.trim() + '\n', 'utf8');

const tail = src.slice(mainJs.after);
console.log('head.html   ', headTop.length);
console.log('styles.css  ', appCss.text.length);
console.log('body.html   ', bodyHtml.length);
console.log('app.js      ', mainJs.text.length);
console.log('выброшено: cf-fonts', cfFonts.text.length, 'байт; хвост', tail.length, 'байт');
console.log('хвост, который выбрасываем:', JSON.stringify(tail.slice(0, 120)));
