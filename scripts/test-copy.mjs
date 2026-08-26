// Проверка правил голоса, которые выполняются без модели.
// Длинные тире, эмодзи и фигурные кавычки чинятся на месте, что бы модель ни прислала;
// штампы и восклицательные знаки только называются, потому что правка меняет смысл.
import { readFileSync } from 'node:fs';

const src = readFileSync('src/app/js/07b-copy-lint.js', 'utf8');
const cut = src.slice(0, src.indexOf('// Плашка над статьёй'));   // без вёрстки: там нужен DOM
// getSite живёт в модуле настроек: подсовываем свой сайт, чтобы проверить, что его
// собственные ссылки не считаются чужими
const { cleanCopyText, cleanCopy, copyFindings, copyNotesLine } = new Function(
  'const getSite = () => ({ url: "https://redcheeksgirl.com" });\n'
  + cut + '\nreturn {cleanCopyText,cleanCopy,copyFindings,copyNotesLine};')();

let bad = 0;
const check = (n, c) => { console.log((c ? '  ✓ ' : '  ✗ ') + n); if (!c) bad++; };

console.log('Пунктуация чинится сама');
check('длинное тире становится запятой',
  cleanCopyText('It runs ten minutes — maybe fifteen.') === 'It runs ten minutes, maybe fifteen.');
check('тире без пробелов тоже',
  cleanCopyText('six—twelve players') === 'six, twelve players');
check('диапазон чисел становится дефисом, а не запятой',
  cleanCopyText('Best for ages 5–10.') === 'Best for ages 5-10.');
check('фигурные апострофы выпрямляются',
  cleanCopyText('the mum’s list') === "the mum's list");
check('фигурные кавычки выпрямляются',
  cleanCopyText('“Pin the Tail”') === '"Pin the Tail"');
check('многоточие одним знаком разворачивается',
  cleanCopyText('and so on…') === 'and so on...');
check('неразрывный пробел становится обычным',
  cleanCopyText('12 guests') === '12 guests');

console.log('\nЭмодзи вычищаются');
check('эмодзи из заголовка убран',
  cleanCopyText('🎉 Party Games') === 'Party Games');
check('составной эмодзи убран целиком',
  cleanCopyText('family 👩‍👧 time') === 'family time');
check('после удаления не остаётся двойных пробелов',
  !/ {2}/.test(cleanCopyText('one 🎈 two')));
check('обычный текст не трогается',
  cleanCopyText('Print one copy per guest.') === 'Print one copy per guest.');

console.log('\nОбход статьи');
{
  const art = {
    title: 'Ten Games — Ready to Print 🎉',
    slug: 'ten-games—ready',
    metaDescription: 'x',
    sections: [{ heading: 'Games for Large Groups', content: 'It’s quick — about ten minutes.' }],
    games: [{ name: 'Bingo', url: 'https://a.com/x—y', content: 'Ages 5–10.' }],
    faq: [{ question: 'How many copies…', answer: 'One per guest.' }],
  };
  const n = cleanCopy(art);
  check('заголовок вычищен', art.title === 'Ten Games, Ready to Print');
  check('вложенная секция вычищена', art.sections[0].content === "It's quick, about ten minutes.");
  check('диапазон в игре сохранён дефисом', art.games[0].content === 'Ages 5-10.');
  check('вопрос в FAQ вычищен', art.faq[0].question === 'How many copies...');
  check('ссылка не тронута', art.games[0].url === 'https://a.com/x—y');
  check('slug не тронут', art.slug === 'ten-games—ready');
  check('число исправленных строк посчитано', n === 4);
}

console.log('\nЗамечания, которые правит человек');
{
  const art = {
    title: 'Elevate Your Party',
    metaDescription: 'Ten printable games for a 6-year-old birthday, sorted by the space they need, with the eight that print and how many copies each one takes.',
    intro: 'This isn\'t just a game, it\'s a memory. Experts say icebreakers matter!',
    sections: [{ heading: 'Games', content: 'A curated list that is really very good.' }],
  };
  const notes = copyFindings(art);
  const has = l => notes.some(x => x.label.includes(l));
  check('штампы найдены', has('штампы'));
  check('словоформа тоже считается штампом',
    copyFindings({ sections: [{ content: 'An elevated, curating experience.' }] })
      .some(x => x.label.includes('штампы')));
  check('чистое слово не путается со штампом',
    copyFindings({ sections: [{ content: 'Eleven games on a level table.' }] }).length === 0);
  check('«not just X, it\'s Y» найдено', has('not just'));
  check('безымянный авторитет найден', has('авторитет'));
  check('восклицательный знак найден', has('восклицательные'));
  check('пустые усилители найдены', has('усилители'));
  check('длина meta проверена', has('длина meta'));
}
{
  // ссылки наружу модель придумывала, и все оказались битыми: их надо видеть до публикации
  const art = {
    sections: [{ content: "Read more at <a href='https://www.brides.com/invented-page'>Brides</a> and " +
      "<a href='https://redcheeksgirl.com/real-post'>our post</a> and " +
      "<a href='https://www.amazon.com/s?k=cardstock'>cardstock</a>." }],
  };
  const notes = copyFindings(art);
  const link = notes.find(x => x.label.includes('внешние ссылки'));
  check('чужая ссылка найдена', !!link && link.n === 1);
  check('своя ссылка не считается чужой', !!link && !String(link.sample).includes('redcheeksgirl'));
  check('Amazon не считается чужой ссылкой', !!link && !String(link.sample).includes('amazon'));
}
{
  // фото не про свою идею: ровно случай с полосатым навесом и фотографией шаров
  const art = {
    games: [
      { asset: 'illustration', name: 'Hang a Striped Canopy Over the Crates',
        imagePrompt: 'A cluster of balloons beside a wooden crate of vegetables and a gift bag.' },
      { asset: 'illustration', name: 'Wooden Crate Market Stall',
        imagePrompt: 'A wooden crate stacked with produce on a market stall table.' },
      { asset: 'printable', name: 'Bingo Sheet', imagePrompt: 'A printable bingo sheet.' },
    ],
  };
  const notes = copyFindings(art);
  const drift = notes.find(x => x.label.includes('фото не про свою идею'));
  check('расхождение найдено', !!drift && drift.n === 1);
  check('названа именно та идея', !!drift && /Striped Canopy/.test(drift.sample));
  check('совпадающая идея не помечена', !!drift && !/Market Stall/.test(drift.sample));
  check('строка для интерфейса собирается', /^текст: \d+ замечани/.test(copyNotesLine(notes)));
}
{
  const art = {
    title: 'Ten Printable Games for a 6-Year-Old Birthday',
    // ровно 153 знака: попадает в требуемые 150-155
    metaDescription: 'Ten printable party games for a 6-year-old birthday, sorted by the space each one needs. Eight of them print at home on ordinary A4 paper in ten minutes.',
    intro: 'Ten games for a 6-year-old birthday, sorted by how much space they need. Eight of them print.',
    sections: [{ heading: 'Games for Large Groups', content: 'It runs about ten minutes and works with six to twelve players.' }],
  };
  const notes = copyFindings(art);
  check('чистый текст не вызывает замечаний, их ' + notes.length, notes.length === 0);
  check('пустая строка для чистого текста', copyNotesLine(notes) === '');
}

console.log('\nСборка свода правил');
{
  const h = readFileSync('src/app/js/07a-humanizer.js', 'utf8');
  const build = model => new Function('model', `
    const textModel = () => model;
    ${h}
    return {rules: voiceRules(), tail: voiceReminder(), weak: weakTextModel()};
  `)(model);

  const claude = build('claude');
  const luna = build('openai:gpt@5.6-luna');

  check('голос стоит первым в своде', claude.rules.startsWith('VOICE: Red Cheeks Girl'));
  check('механические правила вошли в свод', claude.rules.includes('MECHANICAL RULES'));
  check('образцы вошли в свод', claude.rules.includes('WORKED EXAMPLES'));
  // голос важнее правил, и порядок это показывает
  check('образцы идут раньше механических правил',
    claude.rules.indexOf('WORKED EXAMPLES') < claude.rules.indexOf('MECHANICAL RULES'));
  check('правила уступают голосу',
    claude.rules.includes('the VOICE above decides how the text sounds'));
  check('выдумывать ссылки запрещено',
    claude.rules.includes('NEVER INVENT A FACT, AND NEVER INVENT A LINK'));
  // длинные перечни убраны: они читались как «пиши меньше»
  ['BANNED VOCABULARY', 'BANNED SENTENCE SHAPES', 'BANNED OPENERS']
    .forEach(s => check(`перечня «${s}» нет`, !claude.rules.includes(s)));
  check('свод одинаков для обеих моделей', claude.rules === luna.rules);
  check('Клод не считается слабой моделью', claude.weak === false);
  check('модель Runware считается слабой', luna.weak === true);
  check('Клоду хвост не уходит', claude.tail === '');
  check('Луне хвост уходит', luna.tail.includes('REMINDER'));

  // Промпт запрещает эти знаки, значит и сам не должен их содержать
  check('в своде нет длинных тире, кроме самого запрета',
    !claude.rules.replace(/\(—\)/g, '').includes('—'));
  check('в своде нет фигурных кавычек', !/[‘’“”]/.test(claude.rules));
  check('в хвосте нет длинных тире', !luna.tail.includes('—'));
}

console.log(bad ? '\nЕСТЬ ПРОБЛЕМЫ' : '\nправила голоса выполняются без модели');
process.exit(bad ? 1 : 0);
