/* ---------- STATE ---------- */
let ST={ refMode:'', paa:[], feat:null, csv:[], article:null, pins:[], refDataUri:null, styleBlock:'', baseRef:null, baseStyle:'', wpCats:[], pubCat:null, batch:null, review:[] };

/* ---------- SETTINGS PERSISTENCE ---------- */
const SKEYS=['claudeKey','runwareKey','pexelsKey','imgModel','imgQuality','refMode','makePins','tone','relAnchor','relUrl'];
// Библиотека референсов: id стиля → адрес картинки. Подбирать референс под каждую
// статью долго, а тем немного и они повторяются. Привязали картинку к стилю один раз —
// дальше стиль выбирается в строке (или колонкой infographic_style в CSV), а сюжет
// листа подставляется от темы статьи. Действует только на печатные листы: фотографии
// идут по своему контракту и стилевой блок не получают.
let STYLE_REFS={};
function styleRefFor(id){ return (STYLE_REFS[id||'']||'').trim()||null; }

function loadSettings(){
  try{
    const s=JSON.parse(localStorage.getItem('pgs_settings')||'{}');
    SKEYS.forEach(k=>{ if($(k)&&s[k]!=null) $(k).value=s[k]; });
    ST.sites=s.sites||[]; ST.activeSite=s.activeSite||0;
    STYLE_REFS=(s.styleRefs&&typeof s.styleRefs==='object')?s.styleRefs:{};
    if(s.csv){ST.csv=s.csv; $('csvInfo').textContent=ST.csv.length+' internal links loaded.';}
  }catch(e){ ST.sites=[]; }
  renderSites(); renderStyleLibrary();
}
function saveSettings(){
  const s={sites:ST.sites,activeSite:parseInt(v('activeSite'))||0,csv:ST.csv,styleRefs:STYLE_REFS};
  SKEYS.forEach(k=>s[k]=v(k));
  localStorage.setItem('pgs_settings',JSON.stringify(s));
}
// Настройки → «Style library»: по строке на каждый стиль, в неё вставляется адрес картинки.
function renderStyleLibrary(){
  const wrap=$('styleLib'); if(!wrap) return;
  wrap.innerHTML=INFO_STYLES.filter(s=>s.id!=='auto').map(s=>{
    const url=STYLE_REFS[s.id]||'';
    return `<div class="row" style="align-items:center;gap:8px;margin-bottom:6px">
      <div style="flex:0 0 116px;font-size:12px">${esc(s.label)}</div>
      ${url?`<img src="${esc(url)}" alt="" style="width:34px;height:34px;object-fit:cover;border-radius:6px;border:1px solid var(--line)">`:''}
      <input type="text" value="${esc(url)}" placeholder="https://… reference for this style"
             onchange="setStyleRef('${s.id}',this.value)" style="flex:1;min-width:120px;font-size:12px">
    </div>`;
  }).join('');
}
function setStyleRef(id,url){
  const u=String(url||'').trim();
  if(u) STYLE_REFS[id]=u; else delete STYLE_REFS[id];
  saveSettings(); renderStyleLibrary();
}
// Настройки сохраняются сразу, как только что-то поменяли. Раньше запись происходила
// только при закрытии ящика настроек или по кнопке — поменять модель и уйти, не сохранив,
// было слишком легко, и понять это можно было лишь по неожиданному результату генерации.
document.addEventListener('change',e=>{
  const id=e.target&&e.target.id;
  if(id&&SKEYS.includes(id)) saveSettings();
});

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
