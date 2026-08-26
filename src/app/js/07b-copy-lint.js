/* ---------- ПРОВЕРКА ТЕКСТА ПОСЛЕ ГЕНЕРАЦИИ ----------
   Часть правил голоса механическая: длинных тире, эмодзи и фигурных кавычек в выдаче
   быть не должно никогда. Просить об этом модель и надеяться, что она услышала, мало,
   особенно модель послабее. Здесь эти три вещи чинятся на месте, без запроса к модели
   и без денег, а всё остальное (штампы, восклицательные знаки, длина meta) собирается
   в список и показывается перед публикацией, чтобы правилось руками в ревью. */

// Поля, которые текст не несут: их трогать нельзя, иначе поедут ссылки и адреса картинок.
const COPY_SKIP_KEYS=['url','href','src','link','slug','image','imageUrl','asin','id','anchorUrl'];

// Эмодзи по свойству Unicode: сюда попадают и составные, и значки вроде ✨ и ™.
const RE_EMOJI=/[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{200D}\u{20E3}]/gu;

function cleanCopyText(s){
  if(typeof s!=='string'||!s) return s;
  let t=s;
  t=t.replace(/[\u2018\u2019\u201A\u201B\u2032]/g,"'");     // фигурные апострофы
  t=t.replace(/[\u201C\u201D\u201E\u201F\u2033]/g,'"');     // фигурные кавычки
  t=t.replace(/(\d)\s*[\u2013\u2014\u2015]\s*(\d)/g,'$1-$2'); // диапазон чисел: 5–10 → 5-10
  t=t.replace(/\s*[\u2014\u2015]\s*/g,', ');                // длинное тире → запятая
  t=t.replace(/\s+[\u2013]\s+/g,', ');                      // короткое тире между словами
  t=t.replace(/\u2026/g,'...');                             // многоточие одним знаком
  t=t.replace(RE_EMOJI,'');
  t=t.replace(/\u00A0/g,' ');
  // подчищаем следы удалений: осиротевшие пробелы и сдвоенные знаки
  t=t.replace(/ {2,}/g,' ');
  t=t.replace(/\s+([,.;:!?])/g,'$1');
  t=t.replace(/,\s*,/g,',');
  t=t.replace(/([.:;])\s*,/g,'$1');
  t=t.replace(/>\s+</g,'><');
  // «🎉 Party Games» после вычистки эмодзи начинался с пробела
  t=t.replace(/^[\s,]+/,'').replace(/\s+$/,'');
  return t;
}

// Обходит статью и чинит каждую текстовую строку. Возвращает число исправленных строк.
function cleanCopy(node,key){
  if(Array.isArray(node)) return node.reduce((n,x,i)=>n+cleanCopy(x,key),0);
  if(node&&typeof node==='object'){
    let n=0;
    for(const k of Object.keys(node)){
      if(COPY_SKIP_KEYS.includes(k)) continue;
      const val=node[k];
      if(typeof val==='string'){
        const fixed=cleanCopyText(val);
        if(fixed!==val){ node[k]=fixed; n++; }
      } else n+=cleanCopy(val,k);
    }
    return n;
  }
  return 0;
}

// Штампы, которые чинить автоматически нельзя: правка меняет смысл, решает человек.
const COPY_BANNED=['delve','elevate','unlock','revolutionize','game-changer','ultimate','seamless',
  'robust','curated','tapestry','realm','testament','showcase','leverage','embark','unleash',
  'boasts','nestled','vibrant','must-have','next-level','pivotal','transformative',
  'dive in','transform your','in today\'s world','you won\'t believe','level up'];
const COPY_FILLER=['really','very','truly','incredibly','absolutely','literally'];

function copyStrings(node,out){
  out=out||[];
  if(Array.isArray(node)){ node.forEach(x=>copyStrings(x,out)); return out; }
  if(node&&typeof node==='object'){
    for(const k of Object.keys(node)){
      if(COPY_SKIP_KEYS.includes(k)) continue;
      if(typeof node[k]==='string') out.push(node[k]);
      else copyStrings(node[k],out);
    }
  }
  return out;
}

// Список замечаний к готовой статье. Ничего не меняет, только называет найденное.
function copyFindings(art){
  if(!art) return [];
  const all=copyStrings(art).join('\n');
  const text=all.replace(/<[^>]*>/g,' ');   // теги не считаем текстом
  const notes=[];
  const add=(label,hits)=>{ if(hits.length) notes.push({label,n:hits.length,sample:hits[0]}); };

  // без закрывающей границы слова: правило запрещает штамп «в любой форме»,
  // а «elevated» и «curating» иначе проходили мимо списка
  const words=COPY_BANNED.filter(w=>new RegExp('\\b'+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i').test(text));
  if(words.length) notes.push({label:'штампы из чёрного списка',n:words.length,sample:words.join(', ')});

  // без \b в начале: чаще всего это «isn't just», где границы слова перед «n't» нет
  add('«not just X, it\'s Y»',text.match(/(?:not|n'?t)\s+just\b[^.!?]{0,60}\bit'?s\b/gi)||[]);
  add('ссылка на безымянный авторитет',text.match(/\b(experts say|studies show|many people find|it'?s widely known)\b/gi)||[]);
  add('восклицательные знаки',text.match(/!/g)||[]);
  add('пустые усилители',COPY_FILLER.filter(w=>new RegExp('\\b'+w+'\\b','i').test(text)));
  add('вода вместо слов',text.match(/\b(it'?s worth noting that|in order to|due to the fact that|that being said)\b/gi)||[]);
  add('концовка про воспоминания',text.match(/\b(possibilities are endless|memories that last|what makes it special|aren'?t planned)\b/gi)||[]);

  // Главная находка: без веб-поиска модель придумывала URL, и все внешние ссылки в статье
  // оказывались битыми. Свои ссылки (из CSV и на свой сайт) и Amazon не считаем.
  const site=(typeof getSite==='function'&&getSite()&&getSite().url)||'';
  const host=String(site).replace(/^https?:\/\//,'').replace(/\/.*$/,'').toLowerCase();
  const hrefs=[...String(all).matchAll(/href=['"]([^'"]+)['"]/gi)].map(m=>m[1]);
  const external=hrefs.filter(u=>/^https?:\/\//i.test(u))
    .filter(u=>!/amazon\./i.test(u))
    .filter(u=>!(host&&u.toLowerCase().includes(host)));
  if(external.length)
    notes.push({label:'внешние ссылки (скорее всего битые)',n:external.length,sample:external[0]});

  const meta=(art.metaDescription||'').trim();
  if(meta&&(meta.length<150||meta.length>155))
    notes.push({label:'длина meta вне 150-155',n:1,sample:meta.length+' знаков'});

  return notes;
}

// Одна строка для интерфейса: «текст: 3 замечания (восклицательные знаки, штампы...)».
function copyNotesLine(notes){
  if(!notes||!notes.length) return '';
  const total=notes.reduce((n,x)=>n+x.n,0);
  return 'текст: '+total+' замечани'+(total===1?'е':(total<5?'я':'й'))+' — '+notes.map(x=>x.label).join(', ');
}

// Плашка над статьёй в превью. Механическое уже исправлено, здесь остаётся только то,
// что решает человек, поэтому это заметка, а не ошибка.
function copyNotesHTML(){
  const notes=ST.copyNotes||[];
  if(!notes.length) return '';
  const items=notes.map(x=>`<li>${esc(x.label)}: <b>${x.n}</b>${x.sample?' <span class="cn-s">'+esc(String(x.sample).slice(0,70))+'</span>':''}</li>`).join('');
  return `<details class="copy-notes"><summary>${esc(copyNotesLine(notes))}</summary><ul>${items}</ul></details>`;
}
