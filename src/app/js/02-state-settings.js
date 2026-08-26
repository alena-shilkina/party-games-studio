/* ---------- STATE ---------- */
let ST={ refMode:'', paa:[], feat:null, csv:[], article:null, pins:[], refDataUri:null, styleBlock:'', baseRef:null, baseStyle:'', wpCats:[], pubCat:null, batch:null, review:[] };

/* ---------- SETTINGS PERSISTENCE ---------- */
const SKEYS=['claudeKey','runwareKey','pexelsKey','imgModel','imgQuality','refMode','textModel','textModelId','pxClaudeIn','pxClaudeOut','pxLunaIn','pxLunaOut','makePins','tone','relAnchor','relUrl'];
/* Цена Claude Sonnet 4.6 на 26 августа 2026: 3 доллара за миллион входных токенов и 15
   за миллион выходных. Подставляется только в пустое поле, поэтому правка руками
   переживает обновление приложения. Цены меняются, сверяй со счетами.
   Для моделей Runware ценника здесь намеренно нет: их ответ несёт точную стоимость
   в usage.cost, и она показывается как есть, без пересчёта по ставке. */
const PRICE_DEFAULTS={pxClaudeIn:'3',pxClaudeOut:'15'};
function loadSettings(){
  try{
    const s=JSON.parse(localStorage.getItem('pgs_settings')||'{}');
    SKEYS.forEach(k=>{ if($(k)&&s[k]!=null) $(k).value=s[k]; });
    Object.keys(PRICE_DEFAULTS).forEach(k=>{ if($(k)&&!$(k).value) $(k).value=PRICE_DEFAULTS[k]; });
    ST.sites=s.sites||[]; ST.activeSite=s.activeSite||0;
    if(s.csv){ST.csv=s.csv; $('csvInfo').textContent=ST.csv.length+' internal links loaded.';}
  }catch(e){ ST.sites=[]; }
  renderSites();
}
function saveSettings(){
  const s={sites:ST.sites,activeSite:parseInt(v('activeSite'))||0,csv:ST.csv};
  SKEYS.forEach(k=>s[k]=v(k));
  localStorage.setItem('pgs_settings',JSON.stringify(s));
}
// Настройки сохраняются сразу, как только что-то поменяли. Раньше запись происходила
// только при закрытии ящика настроек или по кнопке — поменять модель и уйти, не сохранив,
// было слишком легко, и понять это можно было лишь по неожиданному результату генерации.
document.addEventListener('change',e=>{
  const id=e.target&&e.target.id;
  if(id&&SKEYS.includes(id)) saveSettings();
});

/* ---------- СТОИМОСТЬ СТАТЬИ ----------
   Картинки Runware возвращает с точной ценой (в запросе уже стоит includeCost), поэтому
   по ним цифра настоящая, до копейки. Текст считается из токенов по ценам из Настроек —
   это оценка, и в выводе она помечена тильдой. Если цены не заданы, показываем токены
   и честно говорим, что стоимость текста не посчитана, вместо выдуманного числа. */
function costReset(){ ST.cost={inTok:0,outTok:0,imgUsd:0,imgN:0,textUsd:0,textExact:false,model:textModel()}; }
function costAddText(inTok,outTok,exactUsd){
  if(!ST.cost) costReset();
  ST.cost.inTok+=inTok||0; ST.cost.outTok+=outTok||0;
  if(exactUsd!=null&&isFinite(exactUsd)){ ST.cost.textUsd+=exactUsd; ST.cost.textExact=true; }
}
function costAddImage(usd){
  if(!ST.cost) costReset();
  ST.cost.imgN++; if(usd!=null&&isFinite(usd)) ST.cost.imgUsd+=usd;
}
// цена за миллион токенов из Настроек; пусто или мусор → null, и текст не оцениваем
function priceOf(id){ const n=parseFloat(v(id)); return isFinite(n)&&n>=0?n:null; }
function costTextUsd(){
  const c=ST.cost; if(!c) return null;
  if(c.textExact) return c.textUsd;                       // провайдер прислал точную сумму
  const pre=(c.model==='claude')?'pxClaude':'pxLuna';
  const pin=priceOf(pre+'In'), pout=priceOf(pre+'Out');
  if(pin==null||pout==null) return null;
  return c.inTok/1e6*pin + c.outTok/1e6*pout;
}
const usd=x=>'$'+(x<0.1?x.toFixed(4):x.toFixed(3));
const kTok=n=>n>=1000?Math.round(n/1000)+'k':String(n);
// Короткая строка для строки пакета и для очереди ревью.
function costSummary(){
  const c=ST.cost; if(!c||(!c.inTok&&!c.imgN)) return '';
  const t=costTextUsd();
  const img=`${c.imgN} img ${usd(c.imgUsd)}`;
  if(t==null) return `${img} · text ${kTok(c.inTok)}+${kTok(c.outTok)} tok (set prices in ⚙)`;
  return `${usd(t+c.imgUsd)} · ${img} · text ${c.textExact?'':'~'}${usd(t)}`;
}
// Число для суммы по пакету. null, если стоимость текста посчитать нечем.
function costTotalUsd(){
  const c=ST.cost; if(!c) return null;
  const t=costTextUsd(); if(t==null) return null;
  return t+c.imgUsd;
}
// Итог по всему пакету — складываем то, что посчиталось по строкам.
function batchCostLine(){
  const rows=(ST.batch&&ST.batch.rows)||[];
  const done=rows.filter(r=>typeof r.costUsd==='number');
  if(!done.length) return '';
  const sum=done.reduce((a,r)=>a+r.costUsd,0);
  return `batch: ${usd(sum)} over ${done.length} article${done.length>1?'s':''} · ${usd(sum/done.length)} each`;
}

// Режим работы с референсом. У строки пакета может быть свой; если у строки пусто,
// берём общий — тот, что стоит в панели пакета и в сайдбаре (это одно и то же поле).
// ST.refMode выставляет тот, кто задаёт контекст: строка пакета или снимок из ревью.
function refModeNow(){ return ST.refMode || v('refMode') || 'image'; }
function getSite(){ return (ST.sites||[])[parseInt(v('activeSite'))||0]||null; }

function renderSites(){
  const wrap=$('sitesList'); const sel=$('activeSite');
  wrap.innerHTML=(ST.sites||[]).map((s,i)=>`<div class="site-card"><strong>${esc(s.name)}</strong> · cat ${s.cat||'—'}<br>
    <small style="color:var(--muted)">${esc(s.url)}</small>
    <button class="btn btn-ghost btn-sm" style="float:right" onclick="delSite(${i})">Remove</button></div>`).join('');
  sel.innerHTML=(ST.sites||[]).map((s,i)=>`<option value="${i}" ${i===(ST.activeSite||0)?'selected':''}>${esc(s.name)}</option>`).join('')||'<option>No sites yet</option>';
}
function addSite(){
  if(!v('nsName')||!v('nsUrl')){toast('Name and URL required','err');return;}
  ST.sites=ST.sites||[];
  ST.sites.push({name:v('nsName'),url:v('nsUrl').replace(/\/$/,''),username:v('nsUser'),password:v('nsPass'),cat:parseInt(v('nsCat'))||0});
  ['nsName','nsUrl','nsUser','nsPass','nsCat'].forEach(k=>$(k).value='');
  saveSettings();renderSites();toast('Site added','ok');
}
function delSite(i){ ST.sites.splice(i,1); saveSettings(); renderSites(); }

/* ---------- SETTINGS DRAWER ---------- */
function openSettings(){$('drawer').classList.add('on');$('drawerBg').classList.add('on');}
function closeSettings(){$('drawer').classList.remove('on');$('drawerBg').classList.remove('on');saveSettings();}

/* ---------- TOAST + PROGRESS ---------- */
let tt;
function toast(m,type=''){const t=$('toast');t.textContent=m;t.className='toast on '+type;clearTimeout(tt);tt=setTimeout(()=>t.className='toast',2600);}
function prog(pct,lbl){const p=$('prog');p.classList.add('on');$('progFill').style.width=pct+'%';if(lbl)$('progLbl').textContent=lbl;}
function progDone(){setTimeout(()=>$('prog').classList.remove('on'),600);}

/* ---------- PIN VIBE UI ---------- */
function renderVibes(){
  const sel=$('pinVibe'); if(!sel)return;
  sel.innerHTML=Object.keys(PIN_VIBES).map(k=>`<option value="${k}">${k==='Auto'?'Auto (from keyword)':k}</option>`).join('');
  sel.value=activeVibe;
}

/* ---------- FILENAME (from PCC buildImageFilename) ---------- */
function buildFilename(keyword,sub,idx){
  const stop=['for','the','a','an','and','to','with','your','how','ideas','idea','games','game','party','of','best','fun'];
  const clean=s=>(s||'').toLowerCase().replace(/[^a-z0-9\s]/g,'').split(/\s+/).filter(w=>w&&!stop.includes(w)).slice(0,4).join('-');
  const kw=clean(keyword), sb=clean(sub);
  let name=kw; if(sb&&sb!==kw) name=kw+'-'+sb;
  name=name.replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'party-game';
  return name+'-'+String(idx+1).padStart(2,'0')+'.png';
}
