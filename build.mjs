// Собирает исходники из src/app/ в один файл dist/app.html — именно его отдаёт Worker.
// Порядок js-модулей важен: он повторяет порядок в исходном однофайловом приложении.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';

const read = p => readFileSync('src/app/' + p, 'utf8');

// Шрифты. В скачанной с сайта версии здесь лежал блок, который подставил Cloudflare
// (пути /cf-fonts/...) — на новом домене их нет, поэтому подключаем Google Fonts обычной ссылкой.
const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
  + '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
  + '<link rel="stylesheet" href="https://fonts.googleapis.com/css2'
  + '?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,500'
  + '&family=Inter:wght@400;500;600;700&display=swap">';

// все js-модули по алфавиту — они пронумерованы, так что это и есть нужный порядок
const jsFiles = readdirSync('src/app/js').filter(f => f.endsWith('.js')).sort();
if (jsFiles.length !== 22) throw new Error('ожидали 22 js-модуля, нашли ' + jsFiles.length);
const js = jsFiles.map(f => read('js/' + f)).join('\n');

const html = `<!DOCTYPE html>
<html lang="en">
${read('head.html').trim()}
${FONTS}
<style>
${read('styles.css').trim()}
</style>
</head>
<body>
${read('body.html').trim()}
<script>
${js.trim()}
</script>
</body>
</html>
`;

mkdirSync('dist', { recursive: true });
writeFileSync('dist/app.html', html, 'utf8');
console.log('dist/app.html —', (html.length / 1024).toFixed(0) + ' КБ,', jsFiles.length, 'js-модулей');
