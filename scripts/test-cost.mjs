// Проверка подсчёта стоимости статьи. Картинки Runware отдаёт с точной ценой,
// текст считается из токенов по ценам из Настроек. Отдельно следим, что без цен
// приложение показывает токены, а не выдуманную сумму.
import { readFileSync } from 'node:fs';

const src = readFileSync('src/app/js/02-state-settings.js', 'utf8');
const a = src.indexOf('function costReset(');
const b = src.indexOf('\n\n// Режим работы с референсом');
if (a < 0 || b < a) throw new Error('блок подсчёта стоимости не найден');
const code = src.slice(a, b);

const build = (fields = {}, batch = null) => new Function('fields', 'batch', `
  const v = id => (fields[id] || '');
  const ST = { cost: null, batch };
  const textModel = () => fields.textModel || 'claude';
  ${code}
  return { ST, costReset, costAddText, costAddImage, costSummary, costTotalUsd, batchCostLine };
`)(fields, batch);

let bad = 0;
const check = (n, c) => { console.log((c ? '  ✓ ' : '  ✗ ') + n); if (!c) bad++; };

console.log('Цены заданы');
{
  const k = build({ pxClaudeIn: '3', pxClaudeOut: '15' });
  k.costReset();
  k.costAddText(20000, 8000);          // 0.06 + 0.12 = 0.18
  k.costAddText(4000, 1000);           // 0.012 + 0.015 = 0.027
  k.costAddImage(0.0027); k.costAddImage(0.0027); k.costAddImage(0.0031);
  const total = k.costTotalUsd();
  check('текст посчитан по токенам', Math.abs(total - (0.207 + 0.0085)) < 1e-6);
  check('картинки сложены точно', Math.abs(k.ST.cost.imgUsd - 0.0085) < 1e-9);
  // точную строку итога не проверяем: 0.2155 округляется вниз из-за плавающей точки,
  // и тест ломался бы на ровном месте. Смотрим состав.
  const line = k.costSummary();
  check('в строке есть итог, картинки и текст',
    /^\$0\.2\d\d · 3 img \$0\.0085 · text ~\$0\.207$/.test(line));
}

console.log('Цены не заданы');
{
  const k = build({});
  k.costReset();
  k.costAddText(24000, 9000);
  k.costAddImage(0.0027);
  check('итог не выдумывается', k.costTotalUsd() === null);
  check('вместо суммы показаны токены', /text 24k\+9k tok \(set prices/.test(k.costSummary()));
  check('цена картинок всё равно точная', k.costSummary().includes('1 img $0.0027'));
}

console.log('Провайдер прислал точную цену текста');
{
  const k = build({});                        // цен в настройках нет
  k.costReset();
  k.costAddText(1000, 500, 0.004);            // но пришла точная сумма
  check('используется она, а не оценка', Math.abs(k.costTotalUsd() - 0.004) < 1e-9);
  check('тильды в выводе нет', /text \$0\.0040/.test(k.costSummary()));
}

console.log('Вторая модель считается по своим ценам');
{
  const k = build({ textModel: 'luna', pxLunaIn: '0.2', pxLunaOut: '1.6', pxClaudeIn: '3', pxClaudeOut: '15' });
  k.costReset();
  k.costAddText(1000000, 100000);             // 0.2 + 0.16
  check('взяты цены Luna, а не Claude', Math.abs(k.costTotalUsd() - 0.36) < 1e-9);
}

console.log('Итог по пакету');
{
  const k = build({}, { rows: [{ costUsd: 0.21 }, { costUsd: 0.19 }, { costUsd: null }, {}] });
  const line = k.batchCostLine();
  check('складываются только посчитанные строки', /over 2 articles/.test(line));
  check('показана сумма и средняя', /\$0\.400/.test(line) && /\$0\.200 each/.test(line));
}
{
  const k = build({}, { rows: [{}, {}] });
  check('пока нечего складывать — строки нет', k.batchCostLine() === '');
}

console.log(bad ? '\nЕСТЬ ПРОБЛЕМЫ' : '\nподсчёт стоимости работает как задумано');
process.exit(bad ? 1 : 0);
